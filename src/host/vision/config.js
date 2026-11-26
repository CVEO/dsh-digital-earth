/**
 * host/vision/config.js — standalone vision backend configuration persisted in
 * `~/.dsh/digital-earth/vision.json`, decoupled from `sources.json` so catalog
 * contracts stay untouched and vision can target a dedicated model or external
 * OpenAI-compatible VLM / future SAM endpoint independently of chat defaults.
 */
import { existsSync, promises as fs } from 'node:fs'
import { VISION_CONFIG_FILE } from '../constants.js'
import { writeJsonAtomic } from '../fs-util.js'

const configCache = new Map()

export const VISION_MODES = new Set(['dsh-default', 'dsh-model', 'openai-compat'])
export const COORD_SPACES = new Set(['auto', 'unit', 'percent', 'thousand', 'pixel'])

export function defaultVisionConfig() {
  return {
    mode: 'dsh-default',
    allowUnverifiedModalities: true,
    dshModel: {
      provider: '',
      model: '',
    },
    openaiCompat: {
      baseUrl: '',
      apiKey: '',
      model: '',
      coordSpace: 'auto',
      maxTokens: 4096,
    },
  }
}

function cleanStr(value, maxLen = 200) {
  if (typeof value !== 'string') return ''
  return value.replace(/[\u0000-\u001f\u007f]/g, '').trim().slice(0, maxLen)
}

function cleanHttpUrl(value) {
  const text = cleanStr(value, 512)
  if (!text) return ''
  try {
    const parsed = new URL(text)
    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') return ''
    return parsed.toString().replace(/\/+$/, '')
  } catch {
    return ''
  }
}

function cleanMaxTokens(value, fallback = 4096) {
  const num = Number(value)
  if (!Number.isFinite(num)) return fallback
  return Math.max(256, Math.min(16384, Math.round(num)))
}

export function normalizeVisionConfig(raw, existing = null) {
  const base = defaultVisionConfig()
  const prev = existing && typeof existing === 'object' ? existing : base
  const input = raw && typeof raw === 'object' ? raw : {}

  const mode = VISION_MODES.has(input.mode) ? input.mode : base.mode
  const allowUnverifiedModalities = typeof input.allowUnverifiedModalities === 'boolean'
    ? input.allowUnverifiedModalities
    : base.allowUnverifiedModalities

  const dshRaw = input.dshModel && typeof input.dshModel === 'object' ? input.dshModel : {}
  const dshModel = {
    provider: cleanStr(dshRaw.provider, 120),
    model: cleanStr(dshRaw.model, 160),
  }

  const oaRaw = input.openaiCompat && typeof input.openaiCompat === 'object' ? input.openaiCompat : {}
  const rawKey = typeof oaRaw.apiKey === 'string' ? cleanStr(oaRaw.apiKey, 512) : ''
  const clearKey = oaRaw.clearApiKey === true
  const apiKey = clearKey
    ? ''
    : rawKey !== ''
      ? rawKey
      : cleanStr(prev?.openaiCompat?.apiKey, 512)

  const openaiCompat = {
    baseUrl: cleanHttpUrl(oaRaw.baseUrl),
    apiKey,
    model: cleanStr(oaRaw.model, 160),
    coordSpace: COORD_SPACES.has(oaRaw.coordSpace) ? oaRaw.coordSpace : 'auto',
    maxTokens: cleanMaxTokens(oaRaw.maxTokens, 4096),
  }

  return { mode, allowUnverifiedModalities, dshModel, openaiCompat }
}

function maskKey(key) {
  if (!key) return ''
  if (key.length <= 8) return '****'
  return `${key.slice(0, 3)}***${key.slice(-4)}`
}

/** Redact secrets before returning configuration to the panel UI. */
export function redactVisionConfig(config) {
  const safe = normalizeVisionConfig(config)
  return {
    mode: safe.mode,
    allowUnverifiedModalities: safe.allowUnverifiedModalities,
    dshModel: { ...safe.dshModel },
    openaiCompat: {
      baseUrl: safe.openaiCompat.baseUrl,
      model: safe.openaiCompat.model,
      coordSpace: safe.openaiCompat.coordSpace,
      maxTokens: safe.openaiCompat.maxTokens,
      hasApiKey: safe.openaiCompat.apiKey !== '',
      apiKeyHint: maskKey(safe.openaiCompat.apiKey),
    },
  }
}

export async function readVisionConfig(filePath = VISION_CONFIG_FILE) {
  if (configCache.has(filePath)) return configCache.get(filePath)
  if (!existsSync(filePath)) return defaultVisionConfig()
  try {
    const text = await fs.readFile(filePath, 'utf8')
    const normalized = normalizeVisionConfig(JSON.parse(text))
    configCache.set(filePath, normalized)
    return normalized
  } catch {
    return defaultVisionConfig()
  }
}

export async function writeVisionConfig(config, filePath = VISION_CONFIG_FILE) {
  const normalized = normalizeVisionConfig(config)
  await writeJsonAtomic(filePath, normalized)
  configCache.set(filePath, normalized)
  return normalized
}
