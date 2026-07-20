import { existsSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

const OWM_ICON_CODES = Object.freeze([
  '01d', '01n',
  '02d', '02n',
  '03d', '03n',
  '04d', '04n',
  '09d', '09n',
  '10d', '10n',
  '11d', '11n',
  '13d', '13n',
  '50d', '50n'
])

const OWM_ICON_CODE_SET = new Set(OWM_ICON_CODES)

const ICONS_DIR = path.join(__dirname, '../images/weather-icons')

function isValidOwmIconCode (code) {
  return typeof code === 'string' && OWM_ICON_CODE_SET.has(code)
}

function owmIconFileName (code) {
  if (!isValidOwmIconCode(code)) return null
  return `${code}.png`
}

function owmIconPath (code) {
  const fileName = owmIconFileName(code)
  if (!fileName) return null
  return path.join(ICONS_DIR, fileName)
}

// Returns a filesystem path only when the packaged PNG exists.
function resolveWeatherPngPath (code) {
  const p = owmIconPath(code)
  if (!p || !existsSync(p)) return null
  return p
}

export {
  OWM_ICON_CODES,
  isValidOwmIconCode,
  owmIconFileName,
  owmIconPath,
  resolveWeatherPngPath
}
