import { vi } from 'vitest'
import 'chai/register-should'
import WeatherManager, {
  SEVERE_PRECIPITATION_IDS, SEVERE_FOG_DUST_IDS,
  SEVERE_WIND_SPEED, EXTREME_HIGH_TEMP, EXTREME_LOW_TEMP,
  mapCaiyunSkycon
} from '../app/utils/weatherManager'

// Mock electron-log for test environment
vi.mock('electron-log/main.js', () => ({
  default: {
    info: () => {},
    warn: () => {},
    error: () => {}
  }
}))

// Minimal mock settings object
function createMockSettings (overrides = {}) {
  const defaults = {
    weatherEnabled: false,
    weatherProvider: 'openweathermap',
    weatherApiKey: '',
    weatherCaiyunToken: '',
    weatherCity: '',
    weatherLat: null,
    weatherLon: null,
    weatherLocationName: '',
    weatherOffWorkTime: '17:30',
    weatherWorkdays: [1, 2, 3, 4, 5],
    weatherAlertTypes: {
      precipitation: true,
      wind: true,
      extremeTemp: true,
      fogDust: true
    },
    weatherForecastEnabled: true,
    posLatitude: 0.0,
    posLongitude: 0.0,
    language: 'en'
  }
  const data = { ...defaults, ...overrides }
  return {
    get: (key) => data[key],
    set: (key, value) => { data[key] = value }
  }
}

describe('weatherManager', function () {
  describe('constructor', () => {
    it('should not start when disabled', () => {
      const settings = createMockSettings()
      const wm = new WeatherManager(settings)
      wm.enabled.should.be.equal(false)
      ;(wm.timer === null).should.be.equal(true)
      wm.stop()
    })

    it('should not start without API key', () => {
      const settings = createMockSettings({ weatherEnabled: true })
      const wm = new WeatherManager(settings)
      wm.enabled.should.be.equal(false)
      ;(wm.timer === null).should.be.equal(true)
      wm.stop()
    })

    it('should start with Caiyun token when provider is caiyun', () => {
      const settings = createMockSettings({
        weatherEnabled: true,
        weatherProvider: 'caiyun',
        weatherCaiyunToken: 'test-token',
        weatherLat: 23.1,
        weatherLon: 113.3
      })
      const originalFetch = global.fetch
      global.fetch = vi.fn(async () => ({
        ok: true,
        json: async () => ({ status: 'ok', result: { realtime: { skycon: 'CLEAR_DAY', temperature: 28, apparent_temperature: 29, humidity: 0.6, wind: { speed: 3.6 } }, hourly: { skycon: [] } } })
      }))
      const wm = new WeatherManager(settings)
      try {
        wm.enabled.should.be.equal(true)
      } finally {
        global.fetch = originalFetch
        wm.stop()
      }
    })

    it('should not start Caiyun without token', () => {
      const settings = createMockSettings({
        weatherEnabled: true,
        weatherProvider: 'caiyun',
        weatherCaiyunToken: ''
      })
      const wm = new WeatherManager(settings)
      wm.enabled.should.be.equal(false)
      wm.stop()
    })
  })

  describe('checkSevereWeather', () => {
    let wm
    beforeEach(() => {
      const settings = createMockSettings()
      wm = new WeatherManager(settings)
    })

    afterEach(() => {
      wm.stop()
    })

    it('should detect precipitation from thunderstorm', () => {
      const weather = { conditionId: 211, temp: 20, windSpeed: 3 }
      const result = wm.checkSevereWeather(weather)
      result.should.include('precipitation')
    })

    it('should detect precipitation from rain', () => {
      const weather = { conditionId: 501, temp: 18, windSpeed: 2 }
      const result = wm.checkSevereWeather(weather)
      result.should.include('precipitation')
    })

    it('should detect precipitation from snow', () => {
      const weather = { conditionId: 601, temp: -2, windSpeed: 1 }
      const result = wm.checkSevereWeather(weather)
      result.should.include('precipitation')
    })

    it('should not detect light drizzle as precipitation (300-302)', () => {
      const weather = { conditionId: 300, temp: 15, windSpeed: 1 }
      const result = wm.checkSevereWeather(weather)
      should.not.exist(result)
    })

    it('should detect wind above threshold', () => {
      const weather = { conditionId: 800, temp: 20, windSpeed: 12 }
      const result = wm.checkSevereWeather(weather)
      result.should.include('wind')
    })

    it('should not detect wind below threshold', () => {
      const weather = { conditionId: 800, temp: 20, windSpeed: 5 }
      const result = wm.checkSevereWeather(weather)
      should.not.exist(result)
    })

    it('should detect extreme high temperature', () => {
      const weather = { conditionId: 800, temp: 38, windSpeed: 2 }
      const result = wm.checkSevereWeather(weather)
      result.should.include('extremeHighTemp')
    })

    it('should detect extreme low temperature', () => {
      const weather = { conditionId: 800, temp: -15, windSpeed: 3 }
      const result = wm.checkSevereWeather(weather)
      result.should.include('extremeLowTemp')
    })

    it('should not flag normal temperature', () => {
      const weather = { conditionId: 800, temp: 22, windSpeed: 2 }
      const result = wm.checkSevereWeather(weather)
      should.not.exist(result)
    })

    it('should detect fog/dust conditions', () => {
      const weather = { conditionId: 741, temp: 10, windSpeed: 1 }
      const result = wm.checkSevereWeather(weather)
      result.should.include('fogDust')
    })

    it('should detect sand conditions', () => {
      const weather = { conditionId: 751, temp: 30, windSpeed: 5 }
      const result = wm.checkSevereWeather(weather)
      result.should.include('fogDust')
    })

    it('should detect multiple severe conditions at once', () => {
      const weather = { conditionId: 501, temp: -12, windSpeed: 15 }
      const result = wm.checkSevereWeather(weather)
      result.should.include('precipitation')
      result.should.include('wind')
      result.should.include('extremeLowTemp')
    })

    it('should respect alert type settings', () => {
      const settings = createMockSettings({
        weatherAlertTypes: { precipitation: false, wind: true, extremeTemp: true, fogDust: true }
      })
      const localWm = new WeatherManager(settings)
      const weather = { conditionId: 501, temp: 20, windSpeed: 2 }
      const result = localWm.checkSevereWeather(weather)
      should.not.exist(result)
      localWm.stop()
    })

    it('should return null for null weather', () => {
      const result = wm.checkSevereWeather(null)
      should.not.exist(result)
    })
  })

  describe('shouldAlertSevereWeather', () => {
    let wm
    beforeEach(() => {
      const settings = createMockSettings()
      wm = new WeatherManager(settings)
    })

    afterEach(() => {
      wm.stop()
    })

    it('should alert on new severe conditions', () => {
      const weather = { conditionId: 501, temp: 20, windSpeed: 2 }
      const result = wm.shouldAlertSevereWeather(weather)
      result.should.include('precipitation')
    })

    it('should not alert on same conditions twice', () => {
      const weather = { conditionId: 501, temp: 20, windSpeed: 2 }
      wm.shouldAlertSevereWeather(weather)
      const result = wm.shouldAlertSevereWeather(weather)
      should.not.exist(result)
    })

    it('should alert when conditions change', () => {
      const rainWeather = { conditionId: 501, temp: 20, windSpeed: 2 }
      wm.shouldAlertSevereWeather(rainWeather)
      const worseWeather = { conditionId: 501, temp: 20, windSpeed: 15 }
      const result = wm.shouldAlertSevereWeather(worseWeather)
      result.should.include('wind')
    })

    it('should alert again after conditions clear and return', () => {
      const rainWeather = { conditionId: 501, temp: 20, windSpeed: 2 }
      wm.shouldAlertSevereWeather(rainWeather)
      const clearWeather = { conditionId: 800, temp: 22, windSpeed: 2 }
      wm.shouldAlertSevereWeather(clearWeather)
      const rainAgain = { conditionId: 501, temp: 20, windSpeed: 2 }
      const result = wm.shouldAlertSevereWeather(rainAgain)
      result.should.include('precipitation')
    })
  })

  describe('checkOffWorkRainAlert', () => {
    let wm
    beforeEach(() => {
      const settings = createMockSettings()
      wm = new WeatherManager(settings)
    })

    afterEach(() => {
      wm.stop()
    })

    it('should detect rain at off-work time on workday', () => {
      const now = new Date()
      const dayOfWeek = now.getDay() === 0 ? 7 : now.getDay()
      // Skip if today is not a workday
      if (![1, 2, 3, 4, 5].includes(dayOfWeek)) return

      const hours = now.getHours()
      const minutes = now.getMinutes()
      const settings = createMockSettings({
        weatherOffWorkTime: `${hours}:${String(minutes).padStart(2, '0')}`
      })
      const localWm = new WeatherManager(settings)
      const weather = { conditionId: 501, temp: 18 }
      const result = localWm.checkOffWorkRainAlert(weather)
      result.should.be.equal(true)
      localWm.stop()
    })

    it('should not alert for clear weather at off-work time', () => {
      const now = new Date()
      const dayOfWeek = now.getDay() === 0 ? 7 : now.getDay()
      if (![1, 2, 3, 4, 5].includes(dayOfWeek)) return

      const hours = now.getHours()
      const minutes = now.getMinutes()
      const settings = createMockSettings({
        weatherOffWorkTime: `${hours}:${String(minutes).padStart(2, '0')}`
      })
      const localWm = new WeatherManager(settings)
      const weather = { conditionId: 800, temp: 22 }
      const result = localWm.checkOffWorkRainAlert(weather)
      result.should.be.equal(false)
      localWm.stop()
    })

    it('should not alert twice on same day', () => {
      const now = new Date()
      const dayOfWeek = now.getDay() === 0 ? 7 : now.getDay()
      if (![1, 2, 3, 4, 5].includes(dayOfWeek)) return

      const hours = now.getHours()
      const minutes = now.getMinutes()
      const settings = createMockSettings({
        weatherOffWorkTime: `${hours}:${String(minutes).padStart(2, '0')}`
      })
      const localWm = new WeatherManager(settings)
      const weather = { conditionId: 501, temp: 18 }
      localWm.checkOffWorkRainAlert(weather)
      const result = localWm.checkOffWorkRainAlert(weather)
      result.should.be.equal(false)
      localWm.stop()
    })

    it('should not alert on non-workday', () => {
      const now = new Date()
      const dayOfWeek = now.getDay() === 0 ? 7 : now.getDay()
      // Make today a non-workday
      const nonWorkdays = [1, 2, 3, 4, 5, 6, 7].filter(d => d !== dayOfWeek).slice(0, 2)
      const hours = now.getHours()
      const minutes = now.getMinutes()
      const settings = createMockSettings({
        weatherOffWorkTime: `${hours}:${String(minutes).padStart(2, '0')}`,
        weatherWorkdays: nonWorkdays
      })
      const localWm = new WeatherManager(settings)
      const weather = { conditionId: 501, temp: 18 }
      const result = localWm.checkOffWorkRainAlert(weather)
      result.should.be.equal(false)
      localWm.stop()
    })

    it('should not alert outside off-work time window', () => {
      const settings = createMockSettings({ weatherOffWorkTime: '03:00' })
      const localWm = new WeatherManager(settings)
      const weather = { conditionId: 501, temp: 18 }
      const result = localWm.checkOffWorkRainAlert(weather)
      result.should.be.equal(false)
      localWm.stop()
    })

    it('should return false for null weather', () => {
      const result = wm.checkOffWorkRainAlert(null)
      result.should.be.equal(false)
    })
  })

  describe('weatherDisplayText', () => {
    let wm
    beforeEach(() => {
      const settings = createMockSettings()
      wm = new WeatherManager(settings)
    })

    afterEach(() => {
      wm.stop()
    })

    it('should return null when no weather data', () => {
      should.not.exist(wm.weatherDisplayText)
    })

    it('should format weather display text', () => {
      wm.cachedWeather = {
        temp: 26,
        description: 'light rain',
        icon: '10d'
      }
      wm.weatherDisplayText.should.match(/26°C/)
      wm.weatherDisplayText.should.match(/light rain/)
    })

    it('should format menu label without emoji (icon shown separately)', () => {
      wm.cachedWeather = {
        temp: 26,
        description: 'light rain',
        icon: '10d'
      }
      wm.weatherMenuLabel.should.equal('26°C light rain')
      wm.weatherMenuLabel.should.not.match(/[\u2600-\u26FF\uD83C]/u)
    })

    it('should return null menu label when no weather data', () => {
      should.not.exist(wm.weatherMenuLabel)
    })
  })

  describe('forecastDisplayText', () => {
    let wm
    beforeEach(() => {
      const settings = createMockSettings()
      wm = new WeatherManager(settings)
    })

    afterEach(() => {
      wm.stop()
    })

    it('should include emoji icons in tooltip forecast text', () => {
      const t1 = new Date('2026-07-20T14:00:00')
      const t2 = new Date('2026-07-20T17:00:00')
      wm.cachedForecast = [
        { time: t1, temp: 28, icon: '04d', description: 'clouds', conditionId: 804, pop: 0.1 },
        { time: t2, temp: 26, icon: '10d', description: 'rain', conditionId: 500, pop: 0.8 }
      ]
      wm.forecastDisplayText.should.match(/14:00/)
      wm.forecastDisplayText.should.match(/28°C/)
      wm.forecastDisplayText.should.match(/17:00/)
      wm.forecastDisplayText.should.match(/26°C/)
      // emoji present (cloud / rain)
      wm.forecastDisplayText.should.match(/[\u2600-\u26FF\uD83C]/u)
    })

    it('should return null when no forecast', () => {
      should.not.exist(wm.forecastDisplayText)
    })
  })

  describe('_parseWeather', () => {
    it('should parse OpenWeatherMap response', () => {
      const settings = createMockSettings()
      const wm = new WeatherManager(settings)
      const data = {
        main: { temp: 25.7, feels_like: 24.3, humidity: 65 },
        weather: [{ description: 'clear sky', icon: '01d', id: 800 }],
        wind: { speed: 3.5 },
        name: 'Beijing'
      }
      const parsed = wm._parseWeather(data)
      parsed.temp.should.be.equal(26)
      parsed.feelsLike.should.be.equal(24)
      parsed.description.should.be.equal('clear sky')
      parsed.icon.should.be.equal('01d')
      parsed.conditionId.should.be.equal(800)
      parsed.windSpeed.should.be.equal(3.5)
      parsed.city.should.be.equal('Beijing')
      parsed.humidity.should.be.equal(65)
      wm.stop()
    })
  })

  describe('updateSettings', () => {
    it('should start when enabled with API key', () => {
      const settings = createMockSettings({ weatherEnabled: true, weatherApiKey: 'test-key' })
      const wm = new WeatherManager(settings)
      wm.enabled.should.be.equal(true)
      wm.stop()
    })

    it('should stop when disabled', () => {
      const data = {
        weatherEnabled: false,
        weatherApiKey: 'test-key',
        weatherCity: '',
        weatherOffWorkTime: '17:30',
        weatherWorkdays: [1, 2, 3, 4, 5],
        weatherAlertTypes: { precipitation: true, wind: true, extremeTemp: true, fogDust: true },
        posLatitude: 0.0,
        posLongitude: 0.0,
        language: 'en'
      }
      const settings = createMockSettings({ weatherEnabled: true, weatherApiKey: 'test-key' })
      const wm = new WeatherManager(settings)
      wm.enabled.should.be.equal(true)
      // Simulate user disabling weather in preferences
      data.weatherEnabled = false
      settings.get = (key) => data[key]
      wm.updateSettings()
      wm.enabled.should.be.equal(false)
      wm.stop()
    })
  })
})

describe('weatherManager constants', () => {
  it('SEVERE_PRECIPITATION_IDS should include thunderstorm range', () => {
    SEVERE_PRECIPITATION_IDS.should.include(200)
    SEVERE_PRECIPITATION_IDS.should.include(232)
  })

  it('SEVERE_PRECIPITATION_IDS should include rain range', () => {
    SEVERE_PRECIPITATION_IDS.should.include(500)
    SEVERE_PRECIPITATION_IDS.should.include(531)
  })

  it('SEVERE_PRECIPITATION_IDS should not include light drizzle 300-302', () => {
    SEVERE_PRECIPITATION_IDS.should.not.include(300)
    SEVERE_PRECIPITATION_IDS.should.not.include(301)
    SEVERE_PRECIPITATION_IDS.should.not.include(302)
  })

  it('SEVERE_FOG_DUST_IDS should include fog and dust', () => {
    SEVERE_FOG_DUST_IDS.should.include(741)
    SEVERE_FOG_DUST_IDS.should.include(751)
    SEVERE_FOG_DUST_IDS.should.include(761)
  })

  it('wind threshold should be 10.8 m/s', () => {
    SEVERE_WIND_SPEED.should.be.equal(10.8)
  })

  it('temperature thresholds should be 35 and -10', () => {
    EXTREME_HIGH_TEMP.should.be.equal(35)
    EXTREME_LOW_TEMP.should.be.equal(-10)
  })
})

describe('weatherManager location resolution', () => {
  it('prefers saved weather coordinates over city name', async () => {
    const settings = createMockSettings({
      weatherCity: 'Guangzhou',
      weatherLat: 23.1291,
      weatherLon: 113.2644,
      weatherLocationName: 'Tianhe, Guangzhou'
    })
    const wm = new WeatherManager(settings)
    const loc = await wm._getLocation()
    loc.should.deep.equal({ lat: 23.1291, lon: 113.2644 })
    wm.stop()
  })

  it('falls back to city name when coordinates are missing', async () => {
    const settings = createMockSettings({ weatherCity: 'Guangzhou' })
    const wm = new WeatherManager(settings)
    const loc = await wm._getLocation()
    loc.should.deep.equal({ q: 'Guangzhou' })
    wm.stop()
  })

  it('ignores zero placeholder coordinates and uses city', async () => {
    const settings = createMockSettings({
      weatherCity: 'Guangzhou',
      weatherLat: 0,
      weatherLon: 0
    })
    const wm = new WeatherManager(settings)
    const loc = await wm._getLocation()
    loc.should.deep.equal({ q: 'Guangzhou' })
    wm.stop()
  })

  it('parses geocoding API results into selectable locations', () => {
    const settings = createMockSettings()
    const wm = new WeatherManager(settings)
    const parsed = wm._parseGeocodeResults([
      {
        name: 'Tianhe',
        lat: 23.1247,
        lon: 113.3612,
        country: 'CN',
        state: 'Guangdong',
        local_names: { zh: '天河' }
      },
      { name: 'Bad', country: 'CN' }
    ])
    parsed.should.have.length(1)
    parsed[0].name.should.equal('Tianhe')
    parsed[0].displayName.should.match(/Tianhe|天河/)
    parsed[0].lat.should.equal(23.1247)
    parsed[0].lon.should.equal(113.3612)
    wm.stop()
  })

  it('locateByIp returns null-safe public API shape when fetch fails', async () => {
    const settings = createMockSettings()
    const wm = new WeatherManager(settings)
    const originalFetch = global.fetch
    global.fetch = vi.fn(async () => { throw new Error('network down') })
    try {
      const loc = await wm.locateByIp()
      should.not.exist(loc)
    } finally {
      global.fetch = originalFetch
      wm.stop()
    }
  })

  describe('caiyun provider', () => {
    it('mapCaiyunSkycon maps rain and clear for tray/alerts', () => {
      const rain = mapCaiyunSkycon('MODERATE_RAIN', 'zh-CN')
      rain.conditionId.should.equal(501)
      rain.icon.should.equal('10d')
      rain.description.should.equal('中雨')
      const clear = mapCaiyunSkycon('CLEAR_DAY', 'en')
      clear.conditionId.should.equal(800)
      clear.description.should.equal('Clear')
    })

    it('skips Caiyun fetch without coordinates', async () => {
      const settings = createMockSettings({
        weatherProvider: 'caiyun',
        weatherCaiyunToken: 'token',
        weatherCity: 'Guangzhou'
      })
      const wm = new WeatherManager(settings)
      const originalFetch = global.fetch
      global.fetch = vi.fn()
      try {
        const weather = await wm.fetchWeather()
        should.not.exist(weather)
        global.fetch.mock.calls.length.should.equal(0)
      } finally {
        global.fetch = originalFetch
        wm.stop()
      }
    })

    it('parses Caiyun realtime and reuses hourly bundle for forecast', async () => {
      const settings = createMockSettings({
        weatherProvider: 'caiyun',
        weatherCaiyunToken: 'token',
        weatherLat: 23.1291,
        weatherLon: 113.2644,
        weatherLocationName: '广州天河',
        language: 'zh-CN'
      })
      const wm = new WeatherManager(settings)
      const future = new Date(Date.now() + 2 * 60 * 60 * 1000)
      const pad = (n) => String(n).padStart(2, '0')
      const inTwoHours = `${future.getFullYear()}-${pad(future.getMonth() + 1)}-${pad(future.getDate())}T${pad(future.getHours())}:00`
      const originalFetch = global.fetch
      global.fetch = vi.fn(async () => ({
        ok: true,
        json: async () => ({
          status: 'ok',
          result: {
            realtime: {
              skycon: 'LIGHT_RAIN',
              temperature: 26.4,
              apparent_temperature: 27.1,
              humidity: 0.82,
              wind: { speed: 18 } // km/h → 5 m/s
            },
            hourly: {
              skycon: [{ datetime: inTwoHours, value: 'MODERATE_RAIN' }],
              temperature: [{ datetime: inTwoHours, value: 25.2 }],
              precipitation: [{ datetime: inTwoHours, probability: 80 }]
            }
          }
        })
      }))
      try {
        const weather = await wm.fetchWeather()
        weather.temp.should.equal(26)
        weather.description.should.equal('小雨')
        weather.conditionId.should.equal(500)
        weather.city.should.equal('广州天河')
        Math.round(weather.windSpeed * 10).should.equal(50) // 18/3.6 = 5
        weather.humidity.should.equal(82)

        const forecast = await wm.fetchForecast()
        forecast.should.have.length(1)
        forecast[0].conditionId.should.equal(501)
        forecast[0].pop.should.equal(0.8)
        // Combined endpoint should only be called once for weather+forecast
        global.fetch.mock.calls.length.should.equal(1)
        String(global.fetch.mock.calls[0][0]).should.not.match(/alert=false/)
        String(global.fetch.mock.calls[0][0]).should.match(/hourlysteps=12/)
      } finally {
        global.fetch = originalFetch
        wm.stop()
      }
    })
  })
})
