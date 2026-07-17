// Script to generate tray icons
// Requires `@napi-rs/canvas`, `png-to-ico` (npm packages) and, for the `base` step only, the `inkscape` CLI.
// Install the npm packages before running: `npm install --no-save @napi-rs/canvas png-to-ico`
// The committed icons were generated with @napi-rs/canvas@1.0.0 and png-to-ico@3.0.1; pin to these
// versions to reproduce the exact glyph rendering and avoid a noisy regenerated binary diff.
// Run this script using `node graphics/time-intray-icon-generator.js`
// You can optionally pass an argument to generate only specific icons:
// `node graphics/time-intray-icon-generator.js base` - generate base PNGs from SVGs using Inkscape
// `node graphics/time-intray-icon-generator.js baseico` - generate Windows .ico for the base/paused icons
// `node graphics/time-intray-icon-generator.js numbers` - generate number overlay icons (0-99)
// `node graphics/time-intray-icon-generator.js progress` - generate progress overlay icons (0-100)
// `node graphics/time-intray-icon-generator.js weather` - generate weather condition icons (01d..50n)
// `node graphics/time-intray-icon-generator.js weatherNumbers` - generate weather + number overlay icons
// `node graphics/time-intray-icon-generator.js weatherProgress` - generate weather + progress overlay icons
//
// Windows tray icons are emitted as multi-size .ico files (16/20/24/32 = 100/125/150/200% DPI) so Windows
// can pick the crisp native size per display. macOS keeps Template/@2x PNGs and Linux keeps 32px PNGs.
import { createCanvas, loadImage, GlobalFonts } from '@napi-rs/canvas'
import pngToIco from 'png-to-ico'
import { execSync } from 'node:child_process'
import fs from 'node:fs'
import path from 'path'
import { fileURLToPath } from 'url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

const iconsDir = path.join(__dirname, '../app/images/app-icons')

// Use a bolder font for better legibility of the numbers at small tray sizes
GlobalFonts.registerFromPath(path.join(__dirname, 'NotoSans-Bold.ttf'), 'Noto Sans Bold')
const fontFamily = 'Noto Sans Bold'

// Windows DPI ladder embedded in every .ico (100% / 125% / 150% / 200%)
const winIcoSizes = [16, 20, 24, 32]
// Linux tray uses a single PNG; macOS uses 16 + 32@2x
const linuxSize = 32

const baseImageCache = new Map()
async function loadBase (name) {
  if (!baseImageCache.has(name)) {
    baseImageCache.set(name, await loadImage(path.join(iconsDir, `${name}.png`)))
  }
  return baseImageCache.get(name)
}

function newContext (size) {
  const canvas = createCanvas(size, size)
  const ctx = canvas.getContext('2d')
  ctx.imageSmoothingEnabled = true
  ctx.quality = 'best'
  return { canvas, ctx }
}

function drawText (ctx, size, text, fontColor) {
  const textHeightRatio = 0.75
  const maxTextWidthRatio = 0.9
  const safeAreaWidthRatio = 0.12
  ctx.font = `${textHeightRatio * size}px '${fontFamily}'`
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  const textMetrics = ctx.measureText(text)
  const verticalOffsetFix = (textMetrics.actualBoundingBoxAscent - textMetrics.actualBoundingBoxDescent) / 2
  const x = size / 2
  const y = size / 2 + verticalOffsetFix
  const maxTextWidth = maxTextWidthRatio * size

  ctx.save()
  ctx.globalCompositeOperation = 'destination-out'
  ctx.lineCap = 'round'
  ctx.lineJoin = 'round'
  ctx.lineWidth = Math.max(1, safeAreaWidthRatio * size)
  ctx.strokeText(text, x, y, maxTextWidth)
  ctx.fillText(text, x, y, maxTextWidth)
  ctx.restore()

  ctx.fillStyle = fontColor
  ctx.fillText(text, x, y, maxTextWidth)
}

async function renderText (baseName, size, text, fontColor) {
  const baseImage = await loadBase(baseName)
  const { canvas, ctx } = newContext(size)
  ctx.globalAlpha = 0.6
  ctx.drawImage(baseImage, 0, 0, size, size)
  ctx.globalAlpha = 1.0
  drawText(ctx, size, text, fontColor)
  return canvas.toBuffer('image/png')
}

async function renderProgress (baseName, foregroundName, size, percentage) {
  const baseImage = await loadBase(baseName)
  const foregroundImage = await loadBase(foregroundName)
  const { canvas, ctx } = newContext(size)
  ctx.globalAlpha = 0.6
  ctx.drawImage(baseImage, 0, 0, size, size)
  ctx.globalAlpha = 1.0
  const fillHeight = size * (percentage / 100)
  const y = size - fillHeight
  ctx.save()
  ctx.beginPath()
  ctx.rect(0, y, size, fillHeight)
  ctx.clip()
  ctx.drawImage(foregroundImage, 0, 0, size, size)
  ctx.restore()
  return canvas.toBuffer('image/png')
}

async function renderPlain (baseName, size) {
  const baseImage = await loadBase(baseName)
  const { canvas, ctx } = newContext(size)
  ctx.drawImage(baseImage, 0, 0, size, size)
  return canvas.toBuffer('image/png')
}

function writePng (name, buffer) {
  fs.writeFileSync(path.join(iconsDir, `${name}.png`), buffer)
}

async function writeIco (name, frames) {
  fs.writeFileSync(path.join(iconsDir, `${name}.ico`), await pngToIco(frames))
}

// Tray families rendered for Windows (.ico) and Linux (.png)
const winLinuxFamilies = [
  { name: 'tray', base: 'tray', fontColor: '#000000' },
  { name: 'trayDark', base: 'trayDark', fontColor: '#ffffff' },
  { name: 'trayMonochrome', base: 'trayMonochrome', fontColor: '#000000' },
  { name: 'trayMonochromeInverted', base: 'trayMonochromeInvertedOverlay', foreground: 'trayMonochromeInverted', fontColor: '#ffffff' }
]

// Tray families rendered for macOS (16 + 32@2x PNGs). Monochrome uses Template (OS-tinted).
const macFamilies = [
  { name: 'trayMac', base: 'trayMac', suffix: '', fontColor: '#000000' },
  { name: 'trayMacDark', base: 'trayMacDark', suffix: '', fontColor: '#ffffff' },
  { name: 'trayMacMonochrome', base: 'trayMacMonochromeTemplate', suffix: 'Template', fontColor: '#000000' }
]

// Base/paused icons that need a Windows .ico (no number overlay)
const baseIcoNames = [
  'tray', 'trayDark', 'trayPaused', 'trayPausedDark',
  'trayMonochrome', 'trayMonochromePaused',
  'trayMonochromeInverted', 'trayMonochromeInvertedPaused'
]

async function generateBase () {
  const baseIcons = [
    { svg: 'appicon-colour-light-mode.svg', outputs: [{ name: 'tray.png', size: 32 }, { name: 'trayMac.png', size: 16 }, { name: 'trayMac@2x.png', size: 32 }] },
    { svg: 'appicon-colour-dark-mode.svg', outputs: [{ name: 'trayDark.png', size: 32 }, { name: 'trayMacDark.png', size: 16 }, { name: 'trayMacDark@2x.png', size: 32 }] },
    { svg: 'appicon-colour-light-mode-paused.svg', outputs: [{ name: 'trayPaused.png', size: 32 }, { name: 'trayMacPaused.png', size: 16 }, { name: 'trayMacPaused@2x.png', size: 32 }] },
    { svg: 'appicon-colour-dark-mode-paused.svg', outputs: [{ name: 'trayPausedDark.png', size: 32 }, { name: 'trayMacPausedDark.png', size: 16 }, { name: 'trayMacPausedDark@2x.png', size: 32 }] },
    { svg: 'appicon-mono-light-mode.svg', outputs: [{ name: 'trayMonochrome.png', size: 32 }, { name: 'trayMacMonochromeTemplate.png', size: 16 }, { name: 'trayMacMonochromeTemplate@2x.png', size: 32 }] },
    { svg: 'appicon-mono-light-mode-paused.svg', outputs: [{ name: 'trayMonochromePaused.png', size: 32 }, { name: 'trayMacMonochromePausedTemplate.png', size: 16 }, { name: 'trayMacMonochromePausedTemplate@2x.png', size: 32 }] },
    { svg: 'appicon-mono-dark-mode.svg', outputs: [{ name: 'trayMonochromeInverted.png', size: 32 }] },
    { svg: 'appicon-mono-dark-mode-overlay.svg', outputs: [{ name: 'trayMonochromeInvertedOverlay.png', size: 32 }] },
    { svg: 'appicon-mono-dark-mode-paused.svg', outputs: [{ name: 'trayMonochromeInvertedPaused.png', size: 32 }] }
  ]
  for (const icon of baseIcons) {
    const svgPath = path.join(__dirname, icon.svg)
    for (const output of icon.outputs) {
      const outputPath = path.join(iconsDir, output.name)
      execSync(`inkscape '${svgPath}' --export-type=png --export-filename='${outputPath}' --export-width=${output.size} --export-height=${output.size} --export-background-opacity=0`)
      console.log(`Generated ${output.name} (${output.size}x${output.size}) from ${icon.svg}`)
    }
  }
}

async function generateBaseIco () {
  for (const name of baseIcoNames) {
    const frames = await Promise.all(winIcoSizes.map(size => renderPlain(name, size)))
    await writeIco(name, frames)
  }
  console.log('Base/paused .ico icons generated.')
}

async function generateNumbers () {
  for (const family of winLinuxFamilies) {
    for (let i = 0; i < 100; i++) {
      const text = i.toString()
      const frames = await Promise.all(winIcoSizes.map(size => renderText(family.base, size, text, family.fontColor)))
      writePng(`${family.name}Number${i}`, frames[winIcoSizes.indexOf(linuxSize)])
      await writeIco(`${family.name}Number${i}`, frames)
    }
    console.log(`Number icons for ${family.name} processed (.png + .ico).`)
  }
  for (const family of macFamilies) {
    for (let i = 0; i < 100; i++) {
      const text = i.toString()
      writePng(`${family.name}Number${i}${family.suffix}`, await renderText(family.base, 16, text, family.fontColor))
      writePng(`${family.name}Number${i}${family.suffix}@2x`, await renderText(`${family.base}@2x`, 32, text, family.fontColor))
    }
    console.log(`Number icons for ${family.name} (mac) processed.`)
  }
}

async function generateProgress () {
  for (const family of winLinuxFamilies) {
    const foreground = family.foreground || family.base
    for (let i = 0; i <= 100; i++) {
      const frames = await Promise.all(winIcoSizes.map(size => renderProgress(family.base, foreground, size, i)))
      writePng(`${family.name}Progress${i}`, frames[winIcoSizes.indexOf(linuxSize)])
      await writeIco(`${family.name}Progress${i}`, frames)
    }
    console.log(`Progress icons for ${family.name} processed (.png + .ico).`)
  }
  for (const family of macFamilies) {
    for (let i = 0; i <= 100; i++) {
      writePng(`${family.name}Progress${i}${family.suffix}`, await renderProgress(family.base, family.base, 16, i))
      writePng(`${family.name}Progress${i}${family.suffix}@2x`, await renderProgress(`${family.base}@2x`, `${family.base}@2x`, 32, i))
    }
    console.log(`Progress icons for ${family.name} (mac) processed.`)
  }
}

// ── Weather tray icons ──────────────────────────────────────────────
// Pure weather-symbol icons for the system tray.
// OpenWeatherMap icon codes: 01d/01n … 50d/50n
// We group them by the "category" digit-pair (01,02,…,50) and map
// day/night variants to different drawing helpers.

const weatherCodes = ['01', '02', '03', '04', '09', '10', '11', '13', '50']

// Drawing primitives (all coordinates are in a 0‥1 normalised space,
// the caller scales by `size`)

function _circle (ctx, cx, cy, r) {
  ctx.beginPath()
  ctx.arc(cx, cy, r, 0, 2 * Math.PI)
  ctx.fill()
}

function _strokeCircle (ctx, cx, cy, r, lw) {
  ctx.beginPath()
  ctx.arc(cx, cy, r, 0, 2 * Math.PI)
  ctx.lineWidth = lw
  ctx.stroke()
}

// Sun (used for 01d and as part of 02d)
function _drawSun (ctx, s, cx, cy, r) {
  const rays = 8
  const innerR = r * 0.55
  const outerR = r * 1.0
  // rays
  for (let i = 0; i < rays; i++) {
    const a = (i / rays) * 2 * Math.PI - Math.PI / 2
    ctx.beginPath()
    ctx.moveTo(cx + Math.cos(a) * innerR, cy + Math.sin(a) * innerR)
    ctx.lineTo(cx + Math.cos(a) * outerR, cy + Math.sin(a) * outerR)
    ctx.lineWidth = s * 0.06
    ctx.lineCap = 'round'
    ctx.stroke()
  }
  // centre disc
  _circle(ctx, cx, cy, r * 0.4)
}

// Moon crescent (01n)
function _drawMoon (ctx, cx, cy, r) {
  ctx.beginPath()
  ctx.arc(cx, cy, r, 0, 2 * Math.PI)
  ctx.fill()
  // "bite" – a slightly offset circle in background colour
  // We'll use globalCompositeOperation instead
}

// Cloud blob
function _drawCloud (ctx, cx, cy, w, h) {
  ctx.beginPath()
  ctx.arc(cx - w * 0.2, cy + h * 0.05, w * 0.32, 0, 2 * Math.PI)
  ctx.arc(cx + w * 0.12, cy - h * 0.15, w * 0.28, 0, 2 * Math.PI)
  ctx.arc(cx + w * 0.32, cy + h * 0.05, w * 0.25, 0, 2 * Math.PI)
  ctx.closePath()
  ctx.fill()
}

// Rain drops
function _drawRainDrops (ctx, cx, cy, w, count, color) {
  ctx.save()
  ctx.fillStyle = color
  for (let i = 0; i < count; i++) {
    const x = cx - w * 0.25 + (i / (count - 1)) * w * 0.5
    const y = cy + i % 2 === 0 ? 0 : w * 0.06
    ctx.beginPath()
    // teardrop
    ctx.moveTo(x, y)
    ctx.quadraticCurveTo(x - w * 0.035, y + w * 0.08, x, y + w * 0.12)
    ctx.quadraticCurveTo(x + w * 0.035, y + w * 0.08, x, y)
    ctx.fill()
  }
  ctx.restore()
}

// Snowflake
function _drawSnowflake (ctx, cx, cy, r) {
  const arms = 6
  for (let i = 0; i < arms; i++) {
    const a = (i / arms) * 2 * Math.PI
    ctx.beginPath()
    ctx.moveTo(cx, cy)
    ctx.lineTo(cx + Math.cos(a) * r, cy + Math.sin(a) * r)
    ctx.lineWidth = r * 0.15
    ctx.lineCap = 'round'
    ctx.stroke()
  }
}

// Lightning bolt
function _drawBolt (ctx, cx, cy, s) {
  ctx.beginPath()
  ctx.moveTo(cx - s * 0.06, cy - s * 0.15)
  ctx.lineTo(cx + s * 0.02, cy - s * 0.02)
  ctx.lineTo(cx - s * 0.02, cy - s * 0.02)
  ctx.lineTo(cx + s * 0.06, cy + s * 0.15)
  ctx.lineTo(cx - s * 0.02, cy + s * 0.02)
  ctx.lineTo(cx + s * 0.02, cy + s * 0.02)
  ctx.closePath()
  ctx.fill()
}

// Fog / mist lines
function _drawFog (ctx, cx, cy, w, lw) {
  for (let i = -1; i <= 1; i++) {
    ctx.beginPath()
    ctx.moveTo(cx - w * 0.35, cy + i * lw * 2.5)
    ctx.lineTo(cx + w * 0.35, cy + i * lw * 2.5)
    ctx.lineWidth = lw
    ctx.lineCap = 'round'
    ctx.stroke()
  }
}

// Main weather renderer – returns PNG buffer
function renderWeather (size, code, isDark) {
  const { canvas, ctx } = newContext(size)
  const s = size // shorthand
  const fg = isDark ? '#ffffff' : '#000000'
  const accent = isDark ? '#88bbff' : '#2266cc' // blue for rain/water
  const sunColor = isDark ? '#ffcc44' : '#ee8800'
  const boltColor = isDark ? '#ffee66' : '#cc8800'

  ctx.fillStyle = fg
  ctx.strokeStyle = fg

  const cat = code.slice(0, 2)
  const isNight = code.endsWith('n')

  switch (cat) {
    case '01': // clear sky
      if (isNight) {
        // crescent moon
        ctx.fillStyle = fg
        ctx.beginPath()
        ctx.arc(s * 0.5, s * 0.45, s * 0.28, 0, 2 * Math.PI)
        ctx.fill()
        // bite out
        ctx.globalCompositeOperation = 'destination-out'
        ctx.beginPath()
        ctx.arc(s * 0.62, s * 0.38, s * 0.22, 0, 2 * Math.PI)
        ctx.fill()
        ctx.globalCompositeOperation = 'source-over'
        // small stars
        ctx.fillStyle = fg
        _circle(ctx, s * 0.25, s * 0.3, s * 0.025)
        _circle(ctx, s * 0.72, s * 0.65, s * 0.02)
        _circle(ctx, s * 0.3, s * 0.7, s * 0.015)
      } else {
        // sun
        ctx.fillStyle = sunColor
        ctx.strokeStyle = sunColor
        _drawSun(ctx, s, s * 0.5, s * 0.48, s * 0.35)
      }
      break

    case '02': // few clouds
      if (isNight) {
        // small moon + cloud
        ctx.fillStyle = fg
        ctx.beginPath()
        ctx.arc(s * 0.32, s * 0.32, s * 0.16, 0, 2 * Math.PI)
        ctx.fill()
        ctx.globalCompositeOperation = 'destination-out'
        ctx.beginPath()
        ctx.arc(s * 0.39, s * 0.27, s * 0.12, 0, 2 * Math.PI)
        ctx.fill()
        ctx.globalCompositeOperation = 'source-over'
        ctx.fillStyle = fg
        _drawCloud(ctx, s * 0.55, s * 0.58, s * 0.65, s * 0.4)
      } else {
        // small sun + cloud
        ctx.fillStyle = sunColor
        ctx.strokeStyle = sunColor
        _drawSun(ctx, s, s * 0.35, s * 0.3, s * 0.2)
        ctx.fillStyle = fg
        _drawCloud(ctx, s * 0.55, s * 0.6, s * 0.65, s * 0.4)
      }
      break

    case '03': // scattered clouds
      ctx.fillStyle = fg
      _drawCloud(ctx, s * 0.42, s * 0.42, s * 0.55, s * 0.35)
      ctx.globalAlpha = 0.5
      _drawCloud(ctx, s * 0.58, s * 0.55, s * 0.5, s * 0.3)
      ctx.globalAlpha = 1.0
      break

    case '04': // broken/overcast clouds
      ctx.fillStyle = fg
      _drawCloud(ctx, s * 0.38, s * 0.38, s * 0.55, s * 0.32)
      _drawCloud(ctx, s * 0.58, s * 0.55, s * 0.6, s * 0.38)
      break

    case '09': // shower rain
      ctx.fillStyle = fg
      _drawCloud(ctx, s * 0.5, s * 0.35, s * 0.7, s * 0.35)
      _drawRainDrops(ctx, s * 0.5, s * 0.58, s * 0.5, 3, accent)
      break

    case '10': // rain
      ctx.fillStyle = fg
      _drawCloud(ctx, s * 0.5, s * 0.32, s * 0.7, s * 0.35)
      _drawRainDrops(ctx, s * 0.5, s * 0.55, s * 0.5, 3, accent)
      break

    case '11': // thunderstorm
      ctx.fillStyle = fg
      _drawCloud(ctx, s * 0.5, s * 0.3, s * 0.7, s * 0.32)
      ctx.fillStyle = boltColor
      _drawBolt(ctx, s * 0.5, s * 0.6, s)
      break

    case '13': // snow
      ctx.fillStyle = fg
      _drawCloud(ctx, s * 0.5, s * 0.3, s * 0.7, s * 0.35)
      ctx.fillStyle = fg
      ctx.strokeStyle = fg
      _drawSnowflake(ctx, s * 0.35, s * 0.65, s * 0.08)
      _drawSnowflake(ctx, s * 0.5, s * 0.72, s * 0.07)
      _drawSnowflake(ctx, s * 0.65, s * 0.65, s * 0.08)
      break

    case '50': // mist / fog
      ctx.strokeStyle = fg
      _drawFog(ctx, s * 0.5, s * 0.5, s * 0.7, s * 0.08)
      break
  }

  return canvas.toBuffer('image/png')
}

async function generateWeather () {
  // Windows + Linux families (light / dark)
  const families = [
    { prefix: 'trayWeather', isDark: false },
    { prefix: 'trayWeatherDark', isDark: true }
  ]
  // macOS families
  const macFamilies = [
    { prefix: 'trayMacWeather', isDark: false },
    { prefix: 'trayMacWeatherDark', isDark: true }
  ]

  for (const family of families) {
    for (const code of weatherCodes) {
      for (const dn of ['d', 'n']) {
        const iconCode = code + dn
        const name = `${family.prefix}${iconCode}`
        // Windows .ico (multi-size)
        const frames = await Promise.all(winIcoSizes.map(size => renderWeather(size, iconCode, family.isDark)))
        // Linux .png (32px)
        writePng(name, frames[winIcoSizes.indexOf(linuxSize)])
        await writeIco(name, frames)
      }
    }
    console.log(`Weather icons for ${family.prefix} processed (.png + .ico).`)
  }

  for (const family of macFamilies) {
    for (const code of weatherCodes) {
      for (const dn of ['d', 'n']) {
        const iconCode = code + dn
        const name = `${family.prefix}${iconCode}`
        writePng(name, renderWeather(16, iconCode, family.isDark))
        writePng(`${name}@2x`, renderWeather(32, iconCode, family.isDark))
      }
    }
    console.log(`Weather icons for ${family.prefix} (mac) processed.`)
  }
}

// Render weather icon with number text overlay using loadImage from PNG buffer
// Draw smaller text in the bottom-right corner (for weather+number overlays)
// with a contrasting background badge for readability
function drawSmallText (ctx, size, text, fontColor, isDark) {
  const textHeightRatio = 0.38
  const fontSize = textHeightRatio * size
  ctx.font = `bold ${fontSize}px '${fontFamily}'`
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  const maxTextWidth = 0.55 * size

  // Measure text to size the background badge
  const metrics = ctx.measureText(text)
  const textW = Math.min(metrics.width, maxTextWidth)
  const textH = fontSize
  const padX = size * 0.06
  const padY = size * 0.04

  // Badge position (bottom-right area)
  const badgeCx = size * 0.78
  const badgeCy = size * 0.8
  const badgeW = textW + padX * 2
  const badgeH = textH + padY * 2
  const radius = size * 0.06

  // Draw rounded-rect background badge
  ctx.save()
  ctx.fillStyle = isDark ? 'rgba(0,0,0,0.7)' : 'rgba(255,255,255,0.85)'
  ctx.beginPath()
  ctx.moveTo(badgeCx - badgeW / 2 + radius, badgeCy - badgeH / 2)
  ctx.lineTo(badgeCx + badgeW / 2 - radius, badgeCy - badgeH / 2)
  ctx.quadraticCurveTo(badgeCx + badgeW / 2, badgeCy - badgeH / 2, badgeCx + badgeW / 2, badgeCy - badgeH / 2 + radius)
  ctx.lineTo(badgeCx + badgeW / 2, badgeCy + badgeH / 2 - radius)
  ctx.quadraticCurveTo(badgeCx + badgeW / 2, badgeCy + badgeH / 2, badgeCx + badgeW / 2 - radius, badgeCy + badgeH / 2)
  ctx.lineTo(badgeCx - badgeW / 2 + radius, badgeCy + badgeH / 2)
  ctx.quadraticCurveTo(badgeCx - badgeW / 2, badgeCy + badgeH / 2, badgeCx - badgeW / 2, badgeCy + badgeH / 2 - radius)
  ctx.lineTo(badgeCx - badgeW / 2, badgeCy - badgeH / 2 + radius)
  ctx.quadraticCurveTo(badgeCx - badgeW / 2, badgeCy - badgeH / 2, badgeCx - badgeW / 2 + radius, badgeCy - badgeH / 2)
  ctx.closePath()
  ctx.fill()
  ctx.restore()

  // Draw text on top of badge
  ctx.fillStyle = fontColor
  ctx.fillText(text, badgeCx, badgeCy, maxTextWidth)
}

async function renderWeatherWithText (size, iconCode, isDark, text, fontColor) {
  const weatherBuf = renderWeather(size, iconCode, isDark)
  const weatherImage = await loadImage(weatherBuf)
  const { canvas, ctx } = newContext(size)
  ctx.globalAlpha = 0.85
  ctx.drawImage(weatherImage, 0, 0, size, size)
  ctx.globalAlpha = 1.0
  drawSmallText(ctx, size, text, fontColor, isDark)
  return canvas.toBuffer('image/png')
}

async function renderWeatherWithProgress (size, iconCode, isDark, percentage) {
  const weatherBuf = renderWeather(size, iconCode, isDark)
  const weatherImage = await loadImage(weatherBuf)
  const { canvas, ctx } = newContext(size)
  ctx.globalAlpha = 0.85
  ctx.drawImage(weatherImage, 0, 0, size, size)
  ctx.globalAlpha = 1.0
  // Draw progress bar fill on top
  const fillHeight = size * (percentage / 100)
  const y = size - fillHeight
  ctx.save()
  ctx.beginPath()
  ctx.rect(0, y, size, fillHeight)
  ctx.clip()
  // Use a semi-transparent overlay for the progress fill
  ctx.fillStyle = isDark ? 'rgba(255,255,255,0.4)' : 'rgba(0,0,0,0.3)'
  ctx.fillRect(0, y, size, fillHeight)
  ctx.restore()
  return canvas.toBuffer('image/png')
}

async function generateWeatherNumbers () {
  const families = [
    { prefix: 'trayWeather', isDark: false, fontColor: '#000000' },
    { prefix: 'trayWeatherDark', isDark: true, fontColor: '#ffffff' }
  ]
  const macFamilies = [
    { prefix: 'trayMacWeather', isDark: false, fontColor: '#000000' },
    { prefix: 'trayMacWeatherDark', isDark: true, fontColor: '#ffffff' }
  ]

  for (const family of families) {
    for (const code of weatherCodes) {
      for (const dn of ['d', 'n']) {
        const iconCode = code + dn
        for (let i = 0; i < 100; i++) {
          const text = i.toString()
          const name = `${family.prefix}${iconCode}Number${i}`
          const frames = await Promise.all(winIcoSizes.map(size => renderWeatherWithText(size, iconCode, family.isDark, text, family.fontColor)))
          writePng(name, frames[winIcoSizes.indexOf(linuxSize)])
          await writeIco(name, frames)
        }
      }
    }
    console.log(`Weather number icons for ${family.prefix} processed.`)
  }

  for (const family of macFamilies) {
    for (const code of weatherCodes) {
      for (const dn of ['d', 'n']) {
        const iconCode = code + dn
        for (let i = 0; i < 100; i++) {
          const text = i.toString()
          const name = `${family.prefix}${iconCode}Number${i}`
          writePng(name, await renderWeatherWithText(16, iconCode, family.isDark, text, family.fontColor))
          writePng(`${name}@2x`, await renderWeatherWithText(32, iconCode, family.isDark, text, family.fontColor))
        }
      }
    }
    console.log(`Weather number icons for ${family.prefix} (mac) processed.`)
  }
}

async function generateWeatherProgress () {
  const families = [
    { prefix: 'trayWeather', isDark: false },
    { prefix: 'trayWeatherDark', isDark: true }
  ]
  const macFamilies = [
    { prefix: 'trayMacWeather', isDark: false },
    { prefix: 'trayMacWeatherDark', isDark: true }
  ]

  for (const family of families) {
    for (const code of weatherCodes) {
      for (const dn of ['d', 'n']) {
        const iconCode = code + dn
        for (let i = 0; i <= 100; i++) {
          const name = `${family.prefix}${iconCode}Progress${i}`
          const frames = await Promise.all(winIcoSizes.map(size => renderWeatherWithProgress(size, iconCode, family.isDark, i)))
          writePng(name, frames[winIcoSizes.indexOf(linuxSize)])
          await writeIco(name, frames)
        }
      }
    }
    console.log(`Weather progress icons for ${family.prefix} processed.`)
  }

  for (const family of macFamilies) {
    for (const code of weatherCodes) {
      for (const dn of ['d', 'n']) {
        const iconCode = code + dn
        for (let i = 0; i <= 100; i++) {
          const name = `${family.prefix}${iconCode}Progress${i}`
          writePng(name, await renderWeatherWithProgress(16, iconCode, family.isDark, i))
          writePng(`${name}@2x`, await renderWeatherWithProgress(32, iconCode, family.isDark, i))
        }
      }
    }
    console.log(`Weather progress icons for ${family.prefix} (mac) processed.`)
  }
}

const generationMode = process.argv[2]

if (generationMode === 'base') {
  await generateBase()
} else {
  if (!generationMode || generationMode === 'baseico') await generateBaseIco()
  // Number/progress/weather icons are now rendered dynamically at runtime
  // by app/utils/trrayIconRenderer.js – no pre-generation needed.
}
