import { readFileSync, existsSync } from 'node:fs'

function isValidMiniBreakItem (item) {
  return item && typeof item === 'object' && typeof item.data === 'string' && typeof item.enabled === 'boolean'
}

function isValidLongBreakItem (item) {
  return item && typeof item === 'object' && Array.isArray(item.data) && item.data.length >= 2 && typeof item.enabled === 'boolean'
}

function loadExternalIdeas (filePath, type, log) {
  if (!filePath || !existsSync(filePath)) {
    if (log) log.warn(`Stretchly: external ${type} ideas file not found: ${filePath}`)
    return null
  }
  try {
    const content = readFileSync(filePath, 'utf-8')
    const data = JSON.parse(content)
    if (!Array.isArray(data)) {
      if (log) log.warn(`Stretchly: external ${type} ideas file is not an array`)
      return null
    }
    const validator = type === 'miniBreak' ? isValidMiniBreakItem : isValidLongBreakItem
    const validItems = data.filter(validator)
    if (validItems.length === 0) {
      if (log) log.warn(`Stretchly: external ${type} ideas file has no valid items (expected format: { "data": ${type === 'miniBreak' ? '"text"' : '["title", "text"]'}, "enabled": true })`)
      return null
    }
    if (log) log.info(`Stretchly: loaded ${validItems.length}/${data.length} ${type} ideas from ${filePath}`)
    return validItems
  } catch (err) {
    if (log) log.warn(`Stretchly: error reading external ${type} ideas file: ${err.message}`)
    return null
  }
}

export default loadExternalIdeas
