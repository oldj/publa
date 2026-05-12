import crypto from 'crypto'
import fs from 'fs/promises'
import path from 'path'
import { getAllSettings, updateSettings, type LooseSettingType } from './settings'

// 拒绝 image/svg+xml：favicon 通过 /favicon.ico 路由按存储的 mimeType 输出，
// 浏览器若直接访问该 URL 会按 SVG 渲染并执行内嵌 <script>，构成 XSS。
// 用栅格图（ico/png/webp）作为 favicon 已能覆盖全部主流场景。
export const FAVICON_ALLOWED_MIME_TYPES = [
  'image/x-icon',
  'image/vnd.microsoft.icon',
  'image/png',
  'image/webp',
] as const

export const FAVICON_MAX_SIZE = 256 * 1024
export const FAVICON_CACHE_TTL_MS = 60_000

export type FaviconMode = 'default' | 'url' | 'upload'

export interface FaviconConfig {
  mode: FaviconMode
  url: string
  mimeType: string
  version: string
  previewUrl: string
}

export type FaviconAsset =
  | {
      kind: 'binary'
      body: Buffer
      contentType: string
      etag: string
    }
  | {
      kind: 'redirect'
      location: string
      etag: string
    }

export interface CachedFaviconState {
  config: FaviconConfig
  asset: FaviconAsset
  expiresAt: number
}

const DEFAULT_FAVICON_PATH = path.join(process.cwd(), 'public', 'default-favicon.ico')

// 进程内缓存：默认图标文件只读一次，当前站点 favicon 配置按 TTL 复用。
let defaultFaviconAssetPromise: Promise<FaviconAsset> | null = null
let cachedFaviconState: CachedFaviconState | null = null
let pendingFaviconStatePromise: Promise<CachedFaviconState> | null = null
let faviconCacheGeneration = 0

class FaviconError extends Error {
  code: 'EMPTY_FILE' | 'FILE_TOO_LARGE' | 'INVALID_FILE_TYPE' | 'INVALID_URL'

  constructor(code: FaviconError['code'], message: string) {
    super(message)
    this.name = 'FaviconError'
    this.code = code
  }
}

function createVersion(seed: Buffer | string): string {
  return crypto
    .createHash('sha1')
    .update(seed)
    .update(String(Date.now()))
    .digest('hex')
    .slice(0, 12)
}

function createEtag(seed: Buffer | string): string {
  const value = crypto.createHash('sha1').update(seed).digest('hex')
  return `"favicon-${value}"`
}

function normalizeMimeType(value?: string | null): string {
  return value?.trim().toLowerCase() || ''
}

function inferMimeTypeFromFilename(filename: string): string {
  const ext = path.extname(filename).toLowerCase()

  if (ext === '.ico') return 'image/x-icon'
  if (ext === '.png') return 'image/png'
  if (ext === '.webp') return 'image/webp'

  return ''
}

function resolveUploadMimeType(inputMimeType: string | null | undefined, filename: string): string {
  const mimeType = normalizeMimeType(inputMimeType)
  if (mimeType) return mimeType
  return inferMimeTypeFromFilename(filename)
}

function isAllowedMimeType(
  mimeType: string,
): mimeType is (typeof FAVICON_ALLOWED_MIME_TYPES)[number] {
  return FAVICON_ALLOWED_MIME_TYPES.includes(
    mimeType as (typeof FAVICON_ALLOWED_MIME_TYPES)[number],
  )
}

export function normalizeFaviconMode(value?: string | null): FaviconMode {
  if (value === 'url' || value === 'upload') return value
  return 'default'
}

export function buildFaviconHref(version?: string | null): string {
  return `/favicon.ico?v=${encodeURIComponent(version || 'default')}`
}

export function isValidFaviconUrl(value: string): boolean {
  try {
    const url = new URL(value)
    return url.protocol === 'https:'
  } catch {
    return false
  }
}

export function getFaviconConfigFromSettings(allSettings: LooseSettingType): FaviconConfig {
  const rawUrl = String(allSettings.faviconUrl ?? '').trim()
  const rawMimeType = normalizeMimeType(String(allSettings.faviconMimeType ?? ''))
  const rawData = String(allSettings.faviconData ?? '')
  const rawVersion = String(allSettings.faviconVersion ?? '').trim()
  const requestedMode = normalizeFaviconMode(String(allSettings.faviconMode ?? ''))

  let mode: FaviconMode = requestedMode
  if (mode === 'url' && !isValidFaviconUrl(rawUrl)) {
    mode = 'default'
  }
  if (mode === 'upload' && (!rawData || !rawMimeType || !isAllowedMimeType(rawMimeType))) {
    mode = 'default'
  }

  return {
    mode,
    url: rawUrl,
    mimeType: rawMimeType,
    version: rawVersion,
    previewUrl: buildFaviconHref(rawVersion),
  }
}

export async function getFaviconConfig(): Promise<FaviconConfig> {
  return (await getCachedFaviconState()).config
}

function isFaviconCacheFresh(state: CachedFaviconState): boolean {
  return state.expiresAt > Date.now()
}

function createDefaultFaviconConfig(): FaviconConfig {
  return {
    mode: 'default',
    url: '',
    mimeType: '',
    version: '',
    previewUrl: buildFaviconHref(),
  }
}

async function readDefaultFavicon(): Promise<FaviconAsset> {
  if (!defaultFaviconAssetPromise) {
    defaultFaviconAssetPromise = fs
      .readFile(DEFAULT_FAVICON_PATH)
      .then((body) => ({
        kind: 'binary' as const,
        body,
        contentType: 'image/x-icon',
        etag: createEtag(body),
      }))
      .catch((error) => {
        defaultFaviconAssetPromise = null
        throw error
      })
  }

  return defaultFaviconAssetPromise
}

async function buildFaviconAsset(
  settings: LooseSettingType,
  config: FaviconConfig,
): Promise<FaviconAsset> {
  if (config.mode === 'url') {
    return {
      kind: 'redirect',
      location: config.url,
      etag: createEtag(`${config.url}:${config.version}`),
    }
  }

  if (config.mode === 'upload') {
    try {
      const body = Buffer.from(String(settings.faviconData ?? ''), 'base64')
      validateUploadBuffer(body, config.mimeType)
      return {
        kind: 'binary',
        body,
        contentType: config.mimeType,
        etag: createEtag(body),
      }
    } catch {
      return readDefaultFavicon()
    }
  }

  return readDefaultFavicon()
}

async function loadFaviconState(): Promise<CachedFaviconState> {
  let settings: LooseSettingType = {}

  try {
    settings = await getAllSettings()
  } catch {
    return {
      config: createDefaultFaviconConfig(),
      asset: await readDefaultFavicon(),
      expiresAt: Date.now() + FAVICON_CACHE_TTL_MS,
    }
  }

  const config = getFaviconConfigFromSettings(settings)
  const asset = await buildFaviconAsset(settings, config)

  return {
    config,
    asset,
    expiresAt: Date.now() + FAVICON_CACHE_TTL_MS,
  }
}

export async function getCachedFaviconState(): Promise<CachedFaviconState> {
  if (cachedFaviconState && isFaviconCacheFresh(cachedFaviconState)) {
    return cachedFaviconState
  }

  if (!pendingFaviconStatePromise) {
    const generation = faviconCacheGeneration
    const loadPromise = loadFaviconState().then((state) => {
      if (generation === faviconCacheGeneration) {
        cachedFaviconState = state
      }
      return state
    })

    const pendingPromise = loadPromise.finally(() => {
      if (pendingFaviconStatePromise === pendingPromise) {
        pendingFaviconStatePromise = null
      }
    })

    pendingFaviconStatePromise = pendingPromise
  }

  return pendingFaviconStatePromise
}

export function clearFaviconCache() {
  faviconCacheGeneration += 1
  cachedFaviconState = null
  pendingFaviconStatePromise = null
}

function validateUploadBuffer(buffer: Buffer, mimeType: string) {
  if (!buffer.length) {
    throw new FaviconError('EMPTY_FILE', 'Favicon file is empty')
  }
  if (buffer.length > FAVICON_MAX_SIZE) {
    throw new FaviconError('FILE_TOO_LARGE', 'Favicon file is too large')
  }
  if (!isAllowedMimeType(mimeType)) {
    throw new FaviconError('INVALID_FILE_TYPE', 'Favicon file type is not allowed')
  }
}

export async function saveUploadedFavicon(input: {
  buffer: Buffer
  originalFilename: string
  mimeType?: string | null
}): Promise<FaviconConfig> {
  const mimeType = resolveUploadMimeType(input.mimeType, input.originalFilename)
  validateUploadBuffer(input.buffer, mimeType)

  const version = createVersion(input.buffer)
  await updateSettings({
    faviconMode: 'upload',
    faviconUrl: '',
    faviconData: input.buffer.toString('base64'),
    faviconMimeType: mimeType,
    faviconVersion: version,
  })
  clearFaviconCache()

  return {
    mode: 'upload',
    url: '',
    mimeType,
    version,
    previewUrl: buildFaviconHref(version),
  }
}

export async function saveFaviconUrl(inputUrl: string): Promise<FaviconConfig> {
  const url = inputUrl.trim()
  if (!isValidFaviconUrl(url)) {
    throw new FaviconError('INVALID_URL', 'Favicon URL must use HTTPS')
  }

  const version = createVersion(url)
  await updateSettings({
    faviconMode: 'url',
    faviconUrl: url,
    faviconData: '',
    faviconMimeType: '',
    faviconVersion: version,
  })
  clearFaviconCache()

  return {
    mode: 'url',
    url,
    mimeType: '',
    version,
    previewUrl: buildFaviconHref(version),
  }
}

export async function resetFavicon(): Promise<FaviconConfig> {
  await updateSettings({
    faviconMode: 'default',
    faviconUrl: '',
    faviconData: '',
    faviconMimeType: '',
    faviconVersion: '',
  })
  clearFaviconCache()

  return {
    mode: 'default',
    url: '',
    mimeType: '',
    version: '',
    previewUrl: buildFaviconHref(),
  }
}

export async function resolveFaviconAsset(): Promise<FaviconAsset> {
  return (await getCachedFaviconState()).asset
}

export function isFaviconError(error: unknown): error is FaviconError {
  return error instanceof FaviconError
}
