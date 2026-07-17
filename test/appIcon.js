import 'chai/register-should'
import AppIcon from '../app/utils/appIcon'

describe('appIcon', function () {
  it('windowIconFileName works for dark', function () {
    const params = { darkMode: true }
    const appIcon = new AppIcon(params)
    appIcon.windowIconFileName.should.equal('trayDark.png')
  })

  it('windowIconFileName works for light', function () {
    const params = { darkMode: false }
    const appIcon = new AppIcon(params)
    appIcon.windowIconFileName.should.equal('tray.png')
  })

  it('windowIconFileName ignores monochrome and stays colour', function () {
    const params = { darkMode: false, monochrome: true }
    const appIcon = new AppIcon(params)
    appIcon.windowIconFileName.should.equal('tray.png')
  })

  it('windowIconFileName ignores monochrome and stays colour in dark mode', function () {
    const params = { darkMode: true, monochrome: true }
    const appIcon = new AppIcon(params)
    appIcon.windowIconFileName.should.equal('trayDark.png')
  })
})
