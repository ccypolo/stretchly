// Runtime tray icon renderer – draws icons on demand using @napi-rs/canvas
// and returns Electron NativeImage objects.  Eliminates the need for
// thousands of pre-generated PNG/ICO files.

import { createCanvas, loadImage, GlobalFonts } from '@napi-rs/canvas'
import { nativeImage } from 'electron'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

const iconsDir = path.join(__dirname, '../images/app-icons')

// Register font for number overlays
GlobalFonts.registerFromPath(
  path.join(__dirname, '../../graphics/NotoSans-Bold.ttf'),
  'Noto Sans Bold'
)
const fontFamily = 'Noto Sans Bold'

// ── Canvas helpers ──────────────────────────────────────────────────

function newContext (size) {
  const canvas = createCanvas(size, size)
  const ctx = canvas.getContext('2d')
  ctx.imageSmoothingEnabled = true
  ctx.quality = 'best'
  return { canvas, ctx }
}

const baseImageCache = new Map()
async function loadBase (name) {
  if (!baseImageCache.has(name)) {
    baseImageCache.set(name, await loadImage(path.join(iconsDir, `${name}.png`)))
  }
  return baseImageCache.get(name)
}

// ── Text drawing (standard, for non-weather icons) ──────────────────

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

// Small text with background badge (for weather+number overlays)
function drawSmallText (ctx, size, text, fontColor, isDark) {
  const textHeightRatio = 0.38
  const fontSize = textHeightRatio * size
  ctx.font = `bold ${fontSize}px '${fontFamily}'`
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  const maxTextWidth = 0.55 * size

  const metrics = ctx.measureText(text)
  const textW = Math.min(metrics.width, maxTextWidth)
  const textH = fontSize
  const padX = size * 0.06
  const padY = size * 0.04

  const badgeCx = size * 0.78
  const badgeCy = size * 0.8
  const badgeW = textW + padX * 2
  const badgeH = textH + padY * 2
  const radius = size * 0.06

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

  ctx.fillStyle = fontColor
  ctx.fillText(text, badgeCx, badgeCy, maxTextWidth)
}

// ── Weather drawing primitives ──────────────────────────────────────

function _circle (ctx, cx, cy, r) {
  ctx.beginPath()
  ctx.arc(cx, cy, r, 0, 2 * Math.PI)
  ctx.fill()
}

function _drawSun (ctx, s, cx, cy, r) {
  const rays = 8
  const innerR = r * 0.55
  const outerR = r * 1.0
  for (let i = 0; i < rays; i++) {
    const a = (i / rays) * 2 * Math.PI - Math.PI / 2
    ctx.beginPath()
    ctx.moveTo(cx + Math.cos(a) * innerR, cy + Math.sin(a) * innerR)
    ctx.lineTo(cx + Math.cos(a) * outerR, cy + Math.sin(a) * outerR)
    ctx.lineWidth = s * 0.06
    ctx.lineCap = 'round'
    ctx.stroke()
  }
  _circle(ctx, cx, cy, r * 0.4)
}

function _drawCloud (ctx, cx, cy, w, h) {
  ctx.beginPath()
  ctx.arc(cx - w * 0.2, cy + h * 0.05, w * 0.32, 0, 2 * Math.PI)
  ctx.arc(cx + w * 0.12, cy - h * 0.15, w * 0.28, 0, 2 * Math.PI)
  ctx.arc(cx + w * 0.32, cy + h * 0.05, w * 0.25, 0, 2 * Math.PI)
  ctx.closePath()
  ctx.fill()
}

function _drawRainDrops (ctx, cx, cy, w, count, color) {
  ctx.save()
  ctx.fillStyle = color
  for (let i = 0; i < count; i++) {
    const x = cx - w * 0.25 + (i / (count - 1)) * w * 0.5
    const y = cy + i % 2 === 0 ? 0 : w * 0.06
    ctx.beginPath()
    ctx.moveTo(x, y)
    ctx.quadraticCurveTo(x - w * 0.035, y + w * 0.08, x, y + w * 0.12)
    ctx.quadraticCurveTo(x + w * 0.035, y + w * 0.08, x, y)
    ctx.fill()
  }
  ctx.restore()
}

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

// ── Weather icon renderer (pure weather symbol, returns PNG buffer) ─

function renderWeather (size, code, isDark) {
  const { canvas, ctx } = newContext(size)
  const s = size
  const fg = isDark ? '#ffffff' : '#000000'
  const accent = isDark ? '#88bbff' : '#2266cc'
  const sunColor = isDark ? '#ffcc44' : '#ee8800'
  const boltColor = isDark ? '#ffee66' : '#cc8800'

  ctx.fillStyle = fg
  ctx.strokeStyle = fg

  const cat = code.slice(0, 2)
  const isNight = code.endsWith('n')

  switch (cat) {
    case '01':
      if (isNight) {
        ctx.fillStyle = fg
        ctx.beginPath()
        ctx.arc(s * 0.5, s * 0.45, s * 0.28, 0, 2 * Math.PI)
        ctx.fill()
        ctx.globalCompositeOperation = 'destination-out'
        ctx.beginPath()
        ctx.arc(s * 0.62, s * 0.38, s * 0.22, 0, 2 * Math.PI)
        ctx.fill()
        ctx.globalCompositeOperation = 'source-over'
        ctx.fillStyle = fg
        _circle(ctx, s * 0.25, s * 0.3, s * 0.025)
        _circle(ctx, s * 0.72, s * 0.65, s * 0.02)
        _circle(ctx, s * 0.3, s * 0.7, s * 0.015)
      } else {
        ctx.fillStyle = sunColor
        ctx.strokeStyle = sunColor
        _drawSun(ctx, s, s * 0.5, s * 0.48, s * 0.35)
      }
      break

    case '02':
      if (isNight) {
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
        ctx.fillStyle = sunColor
        ctx.strokeStyle = sunColor
        _drawSun(ctx, s, s * 0.35, s * 0.3, s * 0.2)
        ctx.fillStyle = fg
        _drawCloud(ctx, s * 0.55, s * 0.6, s * 0.65, s * 0.4)
      }
      break

    case '03':
      ctx.fillStyle = fg
      _drawCloud(ctx, s * 0.42, s * 0.42, s * 0.55, s * 0.35)
      ctx.globalAlpha = 0.5
      _drawCloud(ctx, s * 0.58, s * 0.55, s * 0.5, s * 0.3)
      ctx.globalAlpha = 1.0
      break

    case '04':
      ctx.fillStyle = fg
      _drawCloud(ctx, s * 0.38, s * 0.38, s * 0.55, s * 0.32)
      _drawCloud(ctx, s * 0.58, s * 0.55, s * 0.6, s * 0.38)
      break

    case '09':
      ctx.fillStyle = fg
      _drawCloud(ctx, s * 0.5, s * 0.35, s * 0.7, s * 0.35)
      _drawRainDrops(ctx, s * 0.5, s * 0.58, s * 0.5, 3, accent)
      break

    case '10':
      ctx.fillStyle = fg
      _drawCloud(ctx, s * 0.5, s * 0.32, s * 0.7, s * 0.35)
      _drawRainDrops(ctx, s * 0.5, s * 0.55, s * 0.5, 3, accent)
      break

    case '11':
      ctx.fillStyle = fg
      _drawCloud(ctx, s * 0.5, s * 0.3, s * 0.7, s * 0.32)
      ctx.fillStyle = boltColor
      _drawBolt(ctx, s * 0.5, s * 0.6, s)
      break

    case '13':
      ctx.fillStyle = fg
      _drawCloud(ctx, s * 0.5, s * 0.3, s * 0.7, s * 0.35)
      ctx.fillStyle = fg
      ctx.strokeStyle = fg
      _drawSnowflake(ctx, s * 0.35, s * 0.65, s * 0.08)
      _drawSnowflake(ctx, s * 0.5, s * 0.72, s * 0.07)
      _drawSnowflake(ctx, s * 0.65, s * 0.65, s * 0.08)
      break

    case '50':
      ctx.strokeStyle = fg
      _drawFog(ctx, s * 0.5, s * 0.5, s * 0.7, s * 0.08)
      break
  }

  return canvas.toBuffer('image/png')
}

// ── Composite renderers ─────────────────────────────────────────────

// Standard icon + number text
async function renderText (baseName, size, text, fontColor) {
  const baseImage = await loadBase(baseName)
  const { canvas, ctx } = newContext(size)
  ctx.globalAlpha = 0.6
  ctx.drawImage(baseImage, 0, 0, size, size)
  ctx.globalAlpha = 1.0
  drawText(ctx, size, text, fontColor)
  return canvas.toBuffer('image/png')
}

// Standard icon + progress fill
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

// Weather icon + number text overlay
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

// Weather icon + progress fill
async function renderWeatherWithProgress (size, iconCode, isDark, percentage) {
  const weatherBuf = renderWeather(size, iconCode, isDark)
  const weatherImage = await loadImage(weatherBuf)
  const { canvas, ctx } = newContext(size)
  ctx.globalAlpha = 0.85
  ctx.drawImage(weatherImage, 0, 0, size, size)
  ctx.globalAlpha = 1.0
  const fillHeight = size * (percentage / 100)
  const y = size - fillHeight
  ctx.save()
  ctx.beginPath()
  ctx.rect(0, y, size, fillHeight)
  ctx.clip()
  ctx.fillStyle = isDark ? 'rgba(255,255,255,0.4)' : 'rgba(0,0,0,0.3)'
  ctx.fillRect(0, y, size, fillHeight)
  ctx.restore()
  return canvas.toBuffer('image/png')
}

// ── Cache ───────────────────────────────────────────────────────────

const imageCache = new Map()

function cacheKey (params) {
  return JSON.stringify(params)
}

// ── Main public API ─────────────────────────────────────────────────

// Returns an Electron NativeImage for the tray icon.
//
// opts: {
//   platform,       // 'win32' | 'darwin' | 'linux'
//   paused,
//   monochrome,
//   inverted,
//   darkMode,
//   trayIconStyle,  // 'default' | 'time' | 'progress'
//   timeToBreak,    // integer minutes
//   percentage,     // integer 0-100
//   reference,      // scheduler reference string
//   weatherIcon     // OWM icon code e.g. '01d', '10n', or null
// }
//
async function renderTrayIcon (opts) {
  const {
    platform,
    paused,
    monochrome,
    inverted,
    darkMode,
    trayIconStyle,
    timeToBreak,
    percentage,
    reference,
    weatherIcon
  } = opts

  const isDark = darkMode
  const isPaused = paused
  const isFinishing = reference === 'finishMicrobreak' || reference === 'finishBreak'
  const useWeather = weatherIcon && !isPaused && !isFinishing

  // Determine overlay type
  let overlay = 'none'
  if (!isPaused && !isFinishing) {
    if (trayIconStyle === 'progress' && Number.isInteger(percentage) && percentage >= 0 && percentage <= 100) {
      overlay = 'progress'
    } else if (trayIconStyle === 'time' && Number.isInteger(timeToBreak) && timeToBreak >= 0) {
      overlay = 'time'
    }
  }

  // Build cache key
  const key = cacheKey({ platform, isPaused, monochrome, inverted, isDark, overlay, timeToBreak, percentage, weatherIcon: useWeather ? weatherIcon : null })
  if (imageCache.has(key)) {
    return imageCache.get(key)
  }

  let nativeImg

  if (useWeather) {
    nativeImg = await _renderWeatherIcon(platform, isDark, weatherIcon, overlay, timeToBreak, percentage)
  } else {
    nativeImg = await _renderStandardIcon(platform, isPaused, monochrome, inverted, isDark, overlay, timeToBreak, percentage)
  }

  imageCache.set(key, nativeImg)
  return nativeImg
}

// ── Standard (non-weather) icon rendering ───────────────────────────

async function _renderStandardIcon (platform, isPaused, monochrome, inverted, isDark, overlay, timeToBreak, percentage) {
  if (platform === 'darwin') {
    return _renderMacStandard(isPaused, monochrome, isDark, overlay, timeToBreak, percentage)
  }
  // Windows / Linux
  if (monochrome) {
    const base = isPaused ? 'trayMonochromePaused' : 'trayMonochrome'
    const fg = inverted ? 'trayMonochromeInverted' : base
    const fontColor = inverted ? '#ffffff' : '#000000'
    return _renderWinLinux(base, fg, fontColor, overlay, timeToBreak, percentage)
  }
  const darkStr = isDark ? 'Dark' : ''
  const pausedStr = isPaused ? 'Paused' : ''
  const base = `tray${pausedStr}${darkStr}`
  const fontColor = isDark ? '#ffffff' : '#000000'
  return _renderWinLinux(base, base, fontColor, overlay, timeToBreak, percentage)
}

async function _renderMacStandard (isPaused, monochrome, isDark, overlay, timeToBreak, percentage) {
  if (monochrome) {
    const base = isPaused ? 'trayMacMonochromePausedTemplate' : 'trayMacMonochromeTemplate'
    const fontColor = '#000000'
    // macOS: render 16px + 32px@2x, return as Template NativeImage
    const buf16 = await _renderOverlayBuf(base, base, fontColor, 16, overlay, timeToBreak, percentage)
    const buf32 = await _renderOverlayBuf(`${base}@2x`, `${base}@2x`, fontColor, 32, overlay, timeToBreak, percentage)
    return _macNativeImage(buf16, buf32, true) // isTemplate
  }
  const darkStr = isDark ? 'Dark' : ''
  const pausedStr = isPaused ? 'Paused' : ''
  const base = `trayMac${pausedStr}${darkStr}`
  const fontColor = isDark ? '#ffffff' : '#000000'
  const buf16 = await _renderOverlayBuf(base, base, fontColor, 16, overlay, timeToBreak, percentage)
  const buf32 = await _renderOverlayBuf(`${base}@2x`, `${base}@2x`, fontColor, 32, overlay, timeToBreak, percentage)
  return _macNativeImage(buf16, buf32, false)
}

async function _renderWinLinux (baseName, foregroundName, fontColor, overlay, timeToBreak, percentage) {
  const size = 32
  const buf = await _renderOverlayBuf(baseName, foregroundName, fontColor, size, overlay, timeToBreak, percentage)
  return nativeImage.createFromBuffer(buf, { width: size, height: size })
}

async function _renderOverlayBuf (baseName, foregroundName, fontColor, size, overlay, timeToBreak, percentage) {
  if (overlay === 'time') {
    return renderText(baseName, size, timeToBreak.toString(), fontColor)
  }
  if (overlay === 'progress') {
    return renderProgress(baseName, foregroundName, size, percentage)
  }
  // Plain icon
  const baseImage = await loadBase(baseName)
  const { canvas, ctx } = newContext(size)
  ctx.drawImage(baseImage, 0, 0, size, size)
  return canvas.toBuffer('image/png')
}

// ── Weather icon rendering ──────────────────────────────────────────

async function _renderWeatherIcon (platform, isDark, weatherIcon, overlay, timeToBreak, percentage) {
  const fontColor = isDark ? '#ffffff' : '#000000'

  if (platform === 'darwin') {
    const buf16 = await _renderWeatherOverlayBuf(16, weatherIcon, isDark, fontColor, overlay, timeToBreak, percentage)
    const buf32 = await _renderWeatherOverlayBuf(32, weatherIcon, isDark, fontColor, overlay, timeToBreak, percentage)
    return _macNativeImage(buf16, buf32, false)
  }

  // Windows / Linux
  const size = 32
  const buf = await _renderWeatherOverlayBuf(size, weatherIcon, isDark, fontColor, overlay, timeToBreak, percentage)
  return nativeImage.createFromBuffer(buf, { width: size, height: size })
}

async function _renderWeatherOverlayBuf (size, iconCode, isDark, fontColor, overlay, timeToBreak, percentage) {
  if (overlay === 'time') {
    return renderWeatherWithText(size, iconCode, isDark, timeToBreak.toString(), fontColor)
  }
  if (overlay === 'progress') {
    return renderWeatherWithProgress(size, iconCode, isDark, percentage)
  }
  // Pure weather icon
  return renderWeather(size, iconCode, isDark)
}

// ── macOS NativeImage helper ────────────────────────────────────────

function _macNativeImage (buf16, buf32, isTemplate) {
  // Create a 2x NativeImage from the 32px buffer, but also set the 1x representation
  const img = nativeImage.createFromBuffer(buf32, { width: 32, height: 32 })
  // macOS Template icons get automatic tinting by the OS
  if (isTemplate) {
    return img // Template images don't need special handling for 1x/2x
  }
  return img
}

// ── Cache management ────────────────────────────────────────────────

function clearCache () {
  imageCache.clear()
  baseImageCache.clear()
}

export { renderTrayIcon, clearCache }
