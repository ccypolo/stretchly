import { createCanvas, GlobalFonts } from '@napi-rs/canvas'
import { existsSync } from 'node:fs'
import path from 'node:path'

// Shared OWM icon-code → emoji map (used by tooltip text and tray/menu bitmaps).
const WEATHER_EMOJI_BY_CODE = Object.freeze({
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
})

const EMOJI_FONT_FAMILY = 'Stretchly Weather Emoji'
let emojiFontReady = false

function weatherEmojiForCode (code) {
  if (typeof code !== 'string') return ''
  return WEATHER_EMOJI_BY_CODE[code] || ''
}

function candidateEmojiFontPaths () {
  const paths = []
  if (process.platform === 'win32') {
    const windir = process.env.WINDIR || 'C:\\Windows'
    paths.push(path.join(windir, 'Fonts', 'seguiemj.ttf'))
    paths.push(path.join(windir, 'Fonts', 'seguisym.ttf'))
  } else if (process.platform === 'darwin') {
    paths.push('/System/Library/Fonts/Apple Color Emoji.ttc')
  } else {
    paths.push('/usr/share/fonts/truetype/noto/NotoColorEmoji.ttf')
    paths.push('/usr/share/fonts/noto/NotoColorEmoji.ttf')
  }
  return paths
}

function ensureEmojiFont () {
  if (emojiFontReady) return true
  for (const fontPath of candidateEmojiFontPaths()) {
    if (!existsSync(fontPath)) continue
    try {
      GlobalFonts.registerFromPath(fontPath, EMOJI_FONT_FAMILY)
      emojiFontReady = true
      return true
    } catch {
      // try next candidate
    }
  }
  return false
}

/**
 * Rasterize weather emoji to a PNG buffer for tray/menu icons.
 * Returns null when code is unknown or font/render fails.
 */
function renderWeatherEmojiPng (size, code) {
  const emoji = weatherEmojiForCode(code)
  if (!emoji) return null
  if (!ensureEmojiFont()) return null

  try {
    const canvas = createCanvas(size, size)
    const ctx = canvas.getContext('2d')
    ctx.clearRect(0, 0, size, size)
    const fontSize = Math.max(10, Math.floor(size * 0.85))
    ctx.font = `${fontSize}px "${EMOJI_FONT_FAMILY}"`
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    // Slight downward bias improves optical centering for most emoji glyphs.
    ctx.fillText(emoji, size / 2, size / 2 + size * 0.04)
    return canvas.toBuffer('image/png')
  } catch {
    return null
  }
}

export {
  WEATHER_EMOJI_BY_CODE,
  weatherEmojiForCode,
  renderWeatherEmojiPng,
  ensureEmojiFont
}
