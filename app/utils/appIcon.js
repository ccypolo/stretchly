// AppIcon provides file-path based icon names for window icons.
// Tray icons are now rendered dynamically by trayIconRenderer.js,
// so this class no longer generates tray icon file names with
// number/progress/weather suffixes.

class AppIcon {
  constructor ({
    platform,
    paused,
    monochrome,
    inverted,
    darkMode
  }) {
    this.platform = platform
    this.paused = paused
    this.monochrome = monochrome
    this.inverted = inverted
    this.darkMode = darkMode
  }

  get windowIconFileName () {
    const darkModeString = this.darkMode ? 'Dark' : ''
    return `tray${darkModeString}.png`
  }
}

export default AppIcon
