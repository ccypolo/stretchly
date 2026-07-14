import { vi } from 'vitest'
import 'chai/register-should'
import WeatherManager, {
  SEVERE_PRECIPITATION_IDS, SEVERE_FOG_DUST_IDS,
  SEVERE_WIND_SPEED, EXTREME_HIGH_TEMP, EXTREME_LOW_TEMP
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
    weatherApiKey: '',
    weatherCity: '',
    weatherOffWorkTime: '17:30',
    weatherWorkdays: [1, 2, 3, 4, 5],
    weatherAlertTypes: {
      precipitation: true,
      wind: true,
      extremeTemp: true,
      fogDust: true
    },
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
