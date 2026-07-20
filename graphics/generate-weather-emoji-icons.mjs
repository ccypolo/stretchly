import { createCanvas, GlobalFonts } from '@napi-rs/canvas'
import { mkdirSync, writeFileSync, existsSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { WEATHER_EMOJI_BY_CODE } from '../app/utils/weatherEmoji.js'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const outDir = path.join(__dirname, '../app/images/weather-emoji')
const fontPath = path.join(process.env.WINDIR || 'C:\\Windows', 'Fonts', 'seguiemj.ttf')

if (!existsSync(fontPath)) {
  console.error('Missing Segoe UI Emoji font at', fontPath)
  process.exit(1)
}

GlobalFonts.registerFromPath(fontPath, 'Segoe UI Emoji')
mkdirSync(outDir, { recursive: true })

function render (size, emoji) {
  const canvas = createCanvas(size, size)
  const ctx = canvas.getContext('2d')
  ctx.clearRect(0, 0, size, size)
  const fontSize = Math.max(10, Math.floor(size * 0.85))
  ctx.font = `${fontSize}px "Segoe UI Emoji"`
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  ctx.fillText(emoji, size / 2, size / 2 + size * 0.04)
  return canvas.toBuffer('image/png')
}

for (const [code, emoji] of Object.entries(WEATHER_EMOJI_BY_CODE)) {
  for (const size of [16, 32]) {
    const buf = render(size, emoji)
    const file = path.join(outDir, `${code}@${size}.png`)
    writeFileSync(file, buf)
    console.log('wrote', path.basename(file), buf.length)
  }
}

console.log('done', outDir)
