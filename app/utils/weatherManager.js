import EventEmitter from 'events'
import log from 'electron-log/main.js'

const WEATHER_REFRESH_INTERVAL = 10 * 60 * 1000 // 10 minutes
const IP_API_URL = 'http://ip-api.com/json/?fields=status,lat,lon,city'
const OWM_CURRENT_URL = 'https://api.openweathermap.org/data/2.5/weather'

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

class WeatherManager extends EventEmitter {
  constructor (settings) {
    super()
    this.settings = settings
    this.enabled = false
    this.apiKey = settings.get('weatherApiKey')
    this.city = settings.get('weatherCity')
    this.offWorkTime = settings.get('weatherOffWorkTime')
    this.workdays = settings.get('weatherWorkdays')
    this.alertTypes = settings.get('weatherAlertTypes')

    this.cachedWeather = null
    this.cachedLocation = null
    this.lastFetchTime = null
    this.timer = null
    this._started = false
    this._lastAlertedConditions = new Set()
    this._offWorkAlertFiredToday = false
    this._offWorkAlertDate = null

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
    if (this.city) {
      return { q: this.city }
    }
    // Use saved coordinates if available
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
    try {
      const res = await fetch(`${OWM_CURRENT_URL}?${params}`, { signal: AbortSignal.timeout(10000) })
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
      log.error(`Stretchly: weather fetch failed at ${new Date().toISOString()}:`, e.message || e)
      return null
    }
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

  get currentWeather () {
    return this.cachedWeather
  }

  get weatherDisplayText () {
    if (!this.cachedWeather) return null
    const w = this.cachedWeather
    return `${this._weatherEmoji(w.icon)} ${w.temp}°C ${w.description}`
  }

  _weatherEmoji (icon) {
    const map = {
      '01d': '\u2600',
      '01n': '\uD83C\uDF19',
      '02d': '\u26C5',
      '02n': '\u2601',
      '03d': '\u2601',
      '03n': '\u2601',
      '04d': '\u2601',
      '04n': '\u2601',
      '09d': '\uD83C\uDF27',
      '09n': '\uD83C\uDF27',
      '10d': '\uD83C\uDF26',
      '10n': '\uD83C\uDF27',
      '11d': '\u26C8',
      '11n': '\u26C8',
      '13d': '\u2744',
      '13n': '\u2744',
      '50d': '\uD83C\uDF2B',
      '50n': '\uD83C\uDF2B'
    }
    return map[icon] || ''
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
    }

    // Schedule next refresh
    if (!this._started) return
    if (this.timer) clearInterval(this.timer)
    this.timer = setInterval(() => this._refreshWeather(), WEATHER_REFRESH_INTERVAL)
  }

  updateSettings () {
    this.apiKey = this.settings.get('weatherApiKey')
    this.city = this.settings.get('weatherCity')
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
}

export default WeatherManager
export {
  SEVERE_PRECIPITATION_IDS, SEVERE_FOG_DUST_IDS,
  SEVERE_WIND_SPEED, EXTREME_HIGH_TEMP, EXTREME_LOW_TEMP,
  WEATHER_REFRESH_INTERVAL
}
