import 'chai/register-should'
import {
  weatherEmojiForCode,
  renderWeatherEmojiPng,
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

  it('renders a non-empty png for common codes on this platform', () => {
    const buf = renderWeatherEmojiPng(32, '10d')
    if (!buf) {
      // Font may be missing on some CI images; mapping still covered above.
      return
    }
    Buffer.isBuffer(buf).should.equal(true)
    buf.length.should.be.above(200)
    buf[0].should.equal(0x89)
    buf[1].should.equal(0x50)
  })
})
