import 'chai/register-should'
import { existsSync } from 'node:fs'
import {
  OWM_ICON_CODES,
  isValidOwmIconCode,
  owmIconFileName,
  owmIconPath,
  resolveWeatherPngPath,
  readWeatherPngBuffer
} from '../app/utils/owmIcons.js'

describe('owmIcons', () => {
  it('lists all official day/night icon codes', () => {
    OWM_ICON_CODES.should.include.members([
      '01d', '01n', '02d', '10d', '10n', '50d', '50n'
    ])
    OWM_ICON_CODES.should.have.length(18)
  })

  it('accepts valid icon codes only', () => {
    isValidOwmIconCode('10d').should.equal(true)
    isValidOwmIconCode('01n').should.equal(true)
    isValidOwmIconCode('99d').should.equal(false)
    isValidOwmIconCode('').should.equal(false)
    isValidOwmIconCode(null).should.equal(false)
    isValidOwmIconCode('../01d').should.equal(false)
  })

  it('maps code to png file name', () => {
    owmIconFileName('10d').should.equal('10d.png')
    should.not.exist(owmIconFileName('bad'))
  })

  it('resolves path under app/images/weather-icons', () => {
    const p = owmIconPath('10d')
    p.should.match(/weather-icons[/\\]10d\.png$/)
    existsSync(p).should.equal(true)
  })

  it('returns null path for invalid codes', () => {
    should.not.exist(owmIconPath('nope'))
    should.not.exist(owmIconPath(null))
  })

  it('has a packaged png for every official code', () => {
    for (const code of OWM_ICON_CODES) {
      existsSync(owmIconPath(code)).should.equal(true)
    }
  })

  it('resolveWeatherPngPath returns existing packaged files only', () => {
    resolveWeatherPngPath('10d').should.equal(owmIconPath('10d'))
    should.not.exist(resolveWeatherPngPath('bad'))
    should.not.exist(resolveWeatherPngPath(null))
  })

  it('readWeatherPngBuffer returns png bytes for valid codes', () => {
    const buf = readWeatherPngBuffer('10d')
    Buffer.isBuffer(buf).should.equal(true)
    buf.length.should.be.above(100)
    // PNG signature
    buf[0].should.equal(0x89)
    buf[1].should.equal(0x50)
    should.not.exist(readWeatherPngBuffer('bad'))
  })
})
