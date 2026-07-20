import 'chai/register-should'
import {
  weatherEmojiForCode,
  renderWeatherEmojiPng,
  readPackagedEmojiPng,
  WEATHER_EMOJI_BY_CODE
} from '../app/utils/weatherEmoji.js'

describe('weatherEmoji', () => {
  it('maps OWM codes to emoji characters', () => {
    weatherEmojiForCode('01d').should.equal('\u2600')
    weatherEmojiForCode('10d').should.equal('\uD83C\uDF26')
    weatherEmojiForCode('09n').should.equal('\uD83C\uDF27')
    weatherEmojiForCode('bad').should.equal('')
    weatherEmojiForCode(null).should.equal('')
  })

  it('covers all packaged weather icon codes', () => {
    Object.keys(WEATHER_EMOJI_BY_CODE).should.have.length(18)
  })

  it('has packaged emoji png assets for tray sizes', () => {
    for (const code of Object.keys(WEATHER_EMOJI_BY_CODE)) {
      const buf16 = readPackagedEmojiPng(code, 16)
      const buf32 = readPackagedEmojiPng(code, 32)
      Buffer.isBuffer(buf16).should.equal(true)
      Buffer.isBuffer(buf32).should.equal(true)
      buf16.length.should.be.above(100)
      buf32.length.should.be.above(100)
    }
  })

  it('renders a non-empty png for common codes', () => {
    const buf = renderWeatherEmojiPng(32, '10d')
    should.exist(buf)
    Buffer.isBuffer(buf).should.equal(true)
    buf.length.should.be.above(200)
    buf[0].should.equal(0x89)
    buf[1].should.equal(0x50)
  })
})
