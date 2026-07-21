import EventEmitter from 'events'
import log from 'electron-log/main.js'
import { weatherEmojiForCode } from './weatherEmoji.js'

const WEATHER_REFRESH_INTERVAL = 10 * 60 * 1000 // 10 minutes
const IP_API_URL = 'http://ip-api.com/json/?fields=status,lat,lon,city'
const OWM_CURRENT_URL = 'https://api.openweathermap.org/data/2.5/weather'
const OWM_FORECAST_URL = 'https://api.openweathermap.org/data/2.5/forecast'
const OWM_GEOCODE_URL = 'https://api.openweathermap.org/geo/1.0/direct'
const FORECAST_HOURS = 12 // look ahead 12 hours (OWM steps are 3h)
const FORECAST_FETCH_TIMEOUT_MS = 20000
const FORECAST_FETCH_RETRIES = 2
const WEATHER_FETCH_TIMEOUT_MS = 20000
const WEATHER_FETCH_RETRIES = 2
const GEOCODE_FETCH_TIMEOUT_MS = 15000
const GEOCODE_RESULT_LIMIT = 5

// OpenWeatherMap weather condition ID ranges for severe weather detection
// See: https://openweathermap.org/weather-conditions
const SEVERE_PRECIPITATION_IDS = [
  ...range(200, 233), // thunderstorm
  ...range(310, 313), // drizzle (exclude light drizzle 300-302)
  ...range(500, 532), // rain
  ...range(600, 623) // snow
]

const SEVERE_FOG_DUST_IDS = [
  711, 721, // smoke, haze
  731, 741, // dust/sand whirls, fog
  751, 761, 762, // sand, dust, ash
  771, 781 // squall, tornado
]

const SEVERE_WIND_SPEED = 10.8 // m/s, ~Beaufort 6
const EXTREME_HIGH_TEMP = 35 // °C
const EXTREME_LOW_TEMP = -10 // °C

function range (start, end) {
  return Array.from({ length: end - start }, (_, i) => start + i)
}

function isValidWeatherCoordinate (value) {
  return typeof value === 'number' && Number.isFinite(value) && value !== 0
}

class WeatherManager extends EventEmitter {
  constructor (settings) {
    super()
    this.settings = settings
    this.enabled = false
    this.apiKey = settings.get('weatherApiKey')
    this.city = settings.get('weatherCity')
    this.weatherLat = settings.get('weatherLat')
    this.weatherLon = settings.get('weatherLon')
    this.weatherLocationName = settings.get('weatherLocationName') || ''
    this.offWorkTime = settings.get('weatherOffWorkTime')
    this.workdays = settings.get('weatherWorkdays')
    this.alertTypes = settings.get('weatherAlertTypes')

    this.cachedWeather = null
    this.cachedForecast = null
    this.cachedLocation = null
    this.lastFetchTime = null
    this.timer = null
    this._started = false
    this._lastAlertedConditions = new Set()
    this._offWorkAlertFiredToday = false
    this._offWorkAlertDate = null
    this._lastForecastChangeAlert = null

    if (settings.get('weatherEnabled') && this.apiKey) {
      this.start()
    }
  }

  start () {
    if (this._started) return
    this._started = true
    this.enabled = true
    this._refreshWeather()
    log.info('Stretchly: starting weather monitoring')
  }

  stop () {
    if (!this._started) return
    this._started = false
    this.enabled = false
    if (this.timer) {
      clearInterval(this.timer)
    }
    this.timer = null
    log.info('Stretchly: stopping weather monitoring')
  }

  async _locateByIp () {
    try {
      const res = await fetch(IP_API_URL, { signal: AbortSignal.timeout(8000) })
      if (!res.ok) {
        log.error(`Stretchly: IP location API returned ${res.status}`)
        return null
      }
      const data = await res.json()
      if (data.status !== 'success') {
        log.error('Stretchly: IP location API returned fail status')
        return null
      }
      this.cachedLocation = { lat: data.lat, lon: data.lon, city: data.city }
      return this.cachedLocation
    } catch (e) {
      log.error('Stretchly: IP location lookup failed:', e.message || e)
      return null
    }
  }

  async _getLocation () {
    // Selected geocoded point wins over free-text city name.
    if (isValidWeatherCoordinate(this.weatherLat) && isValidWeatherCoordinate(this.weatherLon)) {
      return { lat: this.weatherLat, lon: this.weatherLon }
    }
    if (this.city) {
      return { q: this.city }
    }
    // Use saved coordinates if available (sunrise/legacy settings)
    const savedLat = this.settings.get('posLatitude')
    const savedLon = this.settings.get('posLongitude')
    if (savedLat && savedLon && savedLat !== 0.0 && savedLon !== 0.0) {
      return { lat: savedLat, lon: savedLon }
    }
    // Try IP geolocation
    const loc = await this._locateByIp()
    if (loc) {
      return { lat: loc.lat, lon: loc.lon }
    }
    return null
  }

  _parseGeocodeResults (results) {
    if (!Array.isArray(results)) return []
    return results
      .filter(item => item && isValidWeatherCoordinate(Number(item.lat)) && isValidWeatherCoordinate(Number(item.lon)))
      .map(item => {
        const name = item.name || ''
        const state = item.state || ''
        const country = item.country || ''
        const localName = item.local_names && (item.local_names.zh || item.local_names['zh-CN'])
        const displayParts = [localName || name, state, country].filter(Boolean)
        return {
          name,
          localName: localName || '',
          state,
          country,
          lat: Number(item.lat),
          lon: Number(item.lon),
          displayName: displayParts.join(', ')
        }
      })
  }

  async searchLocations (query) {
    const q = typeof query === 'string' ? query.trim() : ''
    if (!q) return []
    if (!this.apiKey) {
      log.warn('Stretchly: weather API key not set, skipping geocode')
      return []
    }
    const params = new URLSearchParams({
      q,
      limit: String(GEOCODE_RESULT_LIMIT),
      appid: this.apiKey
    })
    try {
      const res = await fetch(`${OWM_GEOCODE_URL}?${params}`, {
        signal: AbortSignal.timeout(GEOCODE_FETCH_TIMEOUT_MS)
      })
      if (!res.ok) {
        log.error(`Stretchly: geocode API returned ${res.status}`)
        return []
      }
      const data = await res.json()
      return this._parseGeocodeResults(data)
    } catch (e) {
      log.error('Stretchly: geocode fetch failed:', e.message || e)
      return []
    }
  }

  async fetchWeather () {
    if (!this.apiKey) {
      log.warn('Stretchly: weather API key not set, skipping fetch')
      return null
    }
    const location = await this._getLocation()
    if (!location) {
      log.warn('Stretchly: no location available for weather fetch')
      return null
    }
    const params = new URLSearchParams({ ...location, appid: this.apiKey, units: 'metric', lang: this.settings.get('language') || 'en' })
    log.info(`Stretchly: fetching weather at ${new Date().toISOString()}`)
    let lastError = null
    for (let attempt = 1; attempt <= WEATHER_FETCH_RETRIES; attempt++) {
      try {
        const res = await fetch(`${OWM_CURRENT_URL}?${params}`, { signal: AbortSignal.timeout(WEATHER_FETCH_TIMEOUT_MS) })
        if (!res.ok) {
          log.error(`Stretchly: weather API returned ${res.status} at ${new Date().toISOString()}`)
          return null
        }
        const data = await res.json()
        this.cachedWeather = this._parseWeather(data)
        this.lastFetchTime = Date.now()
        log.info(`Stretchly: weather updated at ${new Date().toISOString()} - ${this.cachedWeather.city} ${this.cachedWeather.temp}°C ${this.cachedWeather.description} (wind ${this.cachedWeather.windSpeed}m/s, humidity ${this.cachedWeather.humidity}%)`)
        this.emit('weatherUpdated', this.cachedWeather)
        return this.cachedWeather
      } catch (e) {
        lastError = e
        log.error(`Stretchly: weather fetch failed (attempt ${attempt}/${WEATHER_FETCH_RETRIES}) at ${new Date().toISOString()}:`, e.message || e)
      }
    }
    log.error(`Stretchly: weather fetch failed at ${new Date().toISOString()}:`, lastError && (lastError.message || lastError))
    return null
  }

  _parseWeather (data) {
    return {
      temp: Math.round(data.main.temp),
      feelsLike: Math.round(data.main.feels_like),
      description: data.weather[0].description,
      icon: data.weather[0].icon,
      conditionId: data.weather[0].id,
      windSpeed: data.wind.speed,
      city: data.name || '',
      humidity: data.main.humidity,
      timestamp: Date.now()
    }
  }

  async fetchForecast () {
    if (!this.apiKey) return null
    const location = await this._getLocation()
    if (!location) return null
    const params = new URLSearchParams({ ...location, appid: this.apiKey, units: 'metric', lang: this.settings.get('language') || 'en', cnt: 8 })
    let lastError = null
    for (let attempt = 1; attempt <= FORECAST_FETCH_RETRIES; attempt++) {
      try {
        const res = await fetch(`${OWM_FORECAST_URL}?${params}`, { signal: AbortSignal.timeout(FORECAST_FETCH_TIMEOUT_MS) })
        if (!res.ok) {
          log.error(`Stretchly: forecast API returned ${res.status}`)
          return null
        }
        const data = await res.json()
        const forecast = this._parseForecast(data)
        this.cachedForecast = forecast
        log.info(`Stretchly: forecast updated - ${forecast.length} entries`)
        return forecast
      } catch (e) {
        lastError = e
        log.error(`Stretchly: forecast fetch failed (attempt ${attempt}/${FORECAST_FETCH_RETRIES}):`, e.message || e)
      }
    }
    log.error('Stretchly: forecast fetch failed:', lastError && (lastError.message || lastError))
    return null
  }

  _parseForecast (data) {
    if (!data.list) return []
    const now = Date.now()
    const cutoff = now + FORECAST_HOURS * 60 * 60 * 1000
    return data.list
      .filter(item => item.dt * 1000 > now && item.dt * 1000 <= cutoff)
      .map(item => ({
        time: new Date(item.dt * 1000),
        temp: Math.round(item.main.temp),
        description: item.weather[0].description,
        icon: item.weather[0].icon,
        conditionId: item.weather[0].id,
        pop: item.pop // probability of precipitation
      }))
  }

  get currentWeather () {
    return this.cachedWeather
  }

  get weatherDisplayText () {
    if (!this.cachedWeather) return null
    const w = this.cachedWeather
    return `${this._weatherEmoji(w.icon)} ${w.temp}°C ${w.description}`
  }

  // Menu label without emoji – the OWM PNG is shown via MenuItem.icon instead.
  get weatherMenuLabel () {
    if (!this.cachedWeather) return null
    const w = this.cachedWeather
    return `${w.temp}°C ${w.description}`
  }

  _weatherEmoji (icon) {
    return weatherEmojiForCode(icon)
  }

  // Weather category from condition ID (for change detection)
  _weatherCategory (conditionId) {
    if (conditionId >= 200 && conditionId < 300) return 'thunderstorm'
    if (conditionId >= 300 && conditionId < 400) return 'drizzle'
    if (conditionId >= 500 && conditionId < 600) return 'rain'
    if (conditionId >= 600 && conditionId < 700) return 'snow'
    if (conditionId >= 700 && conditionId < 800) return 'fog'
    if (conditionId === 800) return 'clear'
    if (conditionId > 800 && conditionId < 900) return 'cloudy'
    return 'other'
  }

  get forecastDisplayText () {
    if (!this.cachedForecast || this.cachedForecast.length === 0) return null
    // Show up to 3 upcoming forecast entries: "14:00 ☁ 17:00 🌧 20:00 🌧"
    const entries = this.cachedForecast.slice(0, 3)
    return entries.map(f => {
      const hh = f.time.getHours().toString().padStart(2, '0')
      const mm = f.time.getMinutes().toString().padStart(2, '0')
      return `${hh}:${mm} ${this._weatherEmoji(f.icon)} ${f.temp}°C`
    }).join('  ')
  }

  // Detect significant weather changes between current and forecast
  detectWeatherChange () {
    if (!this.cachedWeather || !this.cachedForecast || this.cachedForecast.length === 0) return null

    const currentCategory = this._weatherCategory(this.cachedWeather.conditionId)

    for (const f of this.cachedForecast) {
      const forecastCategory = this._weatherCategory(f.conditionId)
      if (forecastCategory !== currentCategory) {
        // Only alert on significant changes (precipitation, snow, thunderstorm, fog)
        const significantChanges = ['rain', 'drizzle', 'thunderstorm', 'snow', 'fog']
        if (significantChanges.includes(forecastCategory) && !significantChanges.includes(currentCategory)) {
          const hoursAhead = Math.round((f.time.getTime() - Date.now()) / (60 * 60 * 1000))
          const changeKey = `${forecastCategory}-${hoursAhead}`
          // Avoid repeating the same alert
          if (changeKey !== this._lastForecastChangeAlert) {
            this._lastForecastChangeAlert = changeKey
            return { category: forecastCategory, hoursAhead, description: f.description, time: f.time }
          }
        }
      }
    }
    return null
  }

  checkSevereWeather (weather) {
    if (!weather) return null
    const alerts = []

    if (this.alertTypes.precipitation) {
      if (SEVERE_PRECIPITATION_IDS.includes(weather.conditionId)) {
        alerts.push('precipitation')
      }
    }

    if (this.alertTypes.wind) {
      if (weather.windSpeed > SEVERE_WIND_SPEED) {
        alerts.push('wind')
      }
    }

    if (this.alertTypes.extremeTemp) {
      if (weather.temp > EXTREME_HIGH_TEMP) {
        alerts.push('extremeHighTemp')
      } else if (weather.temp < EXTREME_LOW_TEMP) {
        alerts.push('extremeLowTemp')
      }
    }

    if (this.alertTypes.fogDust) {
      if (SEVERE_FOG_DUST_IDS.includes(weather.conditionId)) {
        alerts.push('fogDust')
      }
    }

    return alerts.length > 0 ? alerts : null
  }

  shouldAlertSevereWeather (weather) {
    const currentAlerts = this.checkSevereWeather(weather)
    if (!currentAlerts) {
      this._lastAlertedConditions.clear()
      return null
    }
    const currentSet = new Set(currentAlerts)
    // Only alert if there are new conditions not previously alerted
    const newConditions = currentAlerts.filter(c => !this._lastAlertedConditions.has(c))
    this._lastAlertedConditions = currentSet
    return newConditions.length > 0 ? newConditions : null
  }

  checkOffWorkRainAlert (weather) {
    if (!weather || !this.offWorkTime) return false
    const now = new Date()
    const today = `${now.getFullYear()}-${now.getMonth()}-${now.getDate()}`

    // Reset daily flag at midnight
    if (this._offWorkAlertDate !== today) {
      this._offWorkAlertDate = today
      this._offWorkAlertFiredToday = false
    }

    // Already alerted today
    if (this._offWorkAlertFiredToday) return false

    // Check if today is a workday (1=Mon...7=Sun)
    const dayOfWeek = now.getDay() === 0 ? 7 : now.getDay()
    if (!this.workdays.includes(dayOfWeek)) return false

    // Parse off-work time
    const [hours, minutes] = this.offWorkTime.split(':').map(Number)
    const offWorkMinutes = hours * 60 + minutes
    const nowMinutes = now.getHours() * 60 + now.getMinutes()

    // Within a 5-minute window of off-work time
    if (Math.abs(nowMinutes - offWorkMinutes) > 5) return false

    // Check if it's raining (condition IDs for rain/drizzle/thunderstorm/snow)
    const isRaining = (weather.conditionId >= 200 && weather.conditionId < 600) ||
                      (weather.conditionId >= 600 && weather.conditionId < 700)
    if (!isRaining) return false

    this._offWorkAlertFiredToday = true
    return true
  }

  async _refreshWeather () {
    if (!this._started) return

    const weather = await this.fetchWeather()
    if (!this._started) return

    if (weather) {
      // Check severe weather alerts
      const newAlerts = this.shouldAlertSevereWeather(weather)
      if (newAlerts) {
        this.emit('severeWeatherAlert', newAlerts, weather)
      }

      // Check off-work rain alert
      if (this.checkOffWorkRainAlert(weather)) {
        this.emit('offWorkRainAlert', weather)
      }

      // Fetch forecast if enabled
      if (this.settings.get('weatherForecastEnabled')) {
        const forecast = await this.fetchForecast()
        if (!this._started) return

        if (forecast) {
          this.emit('forecastUpdated', forecast)

          // Check weather change notification
          if (this.settings.get('weatherChangeNotify')) {
            const change = this.detectWeatherChange()
            if (change) {
              this.emit('weatherChangeAlert', change)
            }
          }
        }
      }
    }

    // Schedule next refresh
    if (!this._started) return
    if (this.timer) clearInterval(this.timer)
    this.timer = setInterval(() => this._refreshWeather(), WEATHER_REFRESH_INTERVAL)
  }

  updateSettings () {
    this.apiKey = this.settings.get('weatherApiKey')
    this.city = this.settings.get('weatherCity')
    this.weatherLat = this.settings.get('weatherLat')
    this.weatherLon = this.settings.get('weatherLon')
    this.weatherLocationName = this.settings.get('weatherLocationName') || ''
    this.offWorkTime = this.settings.get('weatherOffWorkTime')
    this.workdays = this.settings.get('weatherWorkdays')
    this.alertTypes = this.settings.get('weatherAlertTypes')
    const shouldEnable = this.settings.get('weatherEnabled') && this.apiKey

    if (shouldEnable && !this.enabled) {
      this.start()
    } else if (!shouldEnable && this.enabled) {
      this.stop()
    }
  }

  refreshNow () {
    if (this._started) {
      this._refreshWeather()
    }
  }
}

export default WeatherManager
export {
  SEVERE_PRECIPITATION_IDS, SEVERE_FOG_DUST_IDS,
  SEVERE_WIND_SPEED, EXTREME_HIGH_TEMP, EXTREME_LOW_TEMP,
  WEATHER_REFRESH_INTERVAL
}
