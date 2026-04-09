import * as schema from '@/server/db/schema'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { setupTestDb, testDb } from './__test__/setup'

type FaviconModule = typeof import('./favicon')

let favicon: FaviconModule

async function getSettingsMap() {
  const rows = await testDb.select().from(schema.settings)
  return Object.fromEntries(
    rows.map((row) => {
      try {
        return [row.key, JSON.parse(row.value)]
      } catch {
        return [row.key, row.value]
      }
    }),
  )
}

describe('favicon service', () => {
  beforeEach(async () => {
    await setupTestDb()
    vi.restoreAllMocks()
    vi.doUnmock('fs/promises')
    vi.resetModules()
    favicon = await import('./favicon')
  })

  it('上传图标后会保存到 settings 并返回可刷新的预览地址', async () => {
    const data = await favicon.saveUploadedFavicon({
      buffer: Buffer.from('png-data'),
      originalFilename: 'icon.png',
      mimeType: 'image/png',
    })

    const settings = await getSettingsMap()
    expect(data.mode).toBe('upload')
    expect(data.mimeType).toBe('image/png')
    expect(data.previewUrl).toBe(favicon.buildFaviconHref(data.version))
    expect(settings.faviconMode).toBe('upload')
    expect(settings.faviconMimeType).toBe('image/png')
    expect(settings.faviconData).toBe(Buffer.from('png-data').toString('base64'))
    expect(settings.faviconVersion).toBe(data.version)

    const asset = await favicon.resolveFaviconAsset()
    expect(asset.kind).toBe('binary')
    if (asset.kind === 'binary') {
      expect(asset.contentType).toBe('image/png')
      expect(asset.body.equals(Buffer.from('png-data'))).toBe(true)
    }
  })

  it('上传 ico 文件时可根据扩展名补全 MIME', async () => {
    const data = await favicon.saveUploadedFavicon({
      buffer: Buffer.from('ico-data'),
      originalFilename: 'icon.ico',
      mimeType: '',
    })

    expect(data.mimeType).toBe('image/x-icon')
  })

  it('不允许上传非白名单格式', async () => {
    await expect(
      favicon.saveUploadedFavicon({
        buffer: Buffer.from('text-data'),
        originalFilename: 'icon.txt',
        mimeType: 'text/plain',
      }),
    ).rejects.toMatchObject({ code: 'INVALID_FILE_TYPE' })
  })

  it('不允许上传超过上限的图标', async () => {
    await expect(
      favicon.saveUploadedFavicon({
        buffer: Buffer.alloc(256 * 1024 + 1),
        originalFilename: 'large.png',
        mimeType: 'image/png',
      }),
    ).rejects.toMatchObject({ code: 'FILE_TOO_LARGE' })
  })

  it('URL 模式只接受 https 并通过站内路由转发', async () => {
    const data = await favicon.saveFaviconUrl('https://cdn.example.com/favicon.png')

    expect(data.mode).toBe('url')
    expect(data.url).toBe('https://cdn.example.com/favicon.png')
    expect(data.previewUrl).toBe(favicon.buildFaviconHref(data.version))

    const asset = await favicon.resolveFaviconAsset()
    expect(asset).toEqual({
      kind: 'redirect',
      location: 'https://cdn.example.com/favicon.png',
      etag: expect.any(String),
    })
  })

  it('拒绝非 https 的图标 URL', async () => {
    await expect(
      favicon.saveFaviconUrl('http://cdn.example.com/favicon.png'),
    ).rejects.toMatchObject({ code: 'INVALID_URL' })
  })

  it('恢复默认后回退到仓库内默认图标', async () => {
    await favicon.saveUploadedFavicon({
      buffer: Buffer.from('png-data'),
      originalFilename: 'icon.png',
      mimeType: 'image/png',
    })

    const data = await favicon.resetFavicon()
    const config = await favicon.getFaviconConfig()
    const asset = await favicon.resolveFaviconAsset()

    expect(data.mode).toBe('default')
    expect(data.previewUrl).toBe('/favicon.ico?v=default')
    expect(config.mode).toBe('default')
    expect(config.version).toBe('')
    expect(asset.kind).toBe('binary')
    if (asset.kind === 'binary') {
      expect(asset.contentType).toBe('image/x-icon')
      expect(asset.body.length).toBeGreaterThan(0)
    }
  })

  it('连续两次 resolveFaviconAsset 在 TTL 内只查库一次', async () => {
    const selectSpy = vi.spyOn(testDb, 'select')

    const first = await favicon.resolveFaviconAsset()
    const second = await favicon.resolveFaviconAsset()

    expect(selectSpy).toHaveBeenCalledTimes(1)
    expect(second).toBe(first)
  })

  it('连续两次 getFaviconConfig 在 TTL 内复用同一缓存', async () => {
    const selectSpy = vi.spyOn(testDb, 'select')

    const first = await favicon.getFaviconConfig()
    const second = await favicon.getFaviconConfig()

    expect(selectSpy).toHaveBeenCalledTimes(1)
    expect(second).toBe(first)
  })

  it('上传后会清空缓存，下一次读取重新查库并返回新图标', async () => {
    const selectSpy = vi.spyOn(testDb, 'select')

    await favicon.resolveFaviconAsset()
    expect(selectSpy).toHaveBeenCalledTimes(1)

    await favicon.saveUploadedFavicon({
      buffer: Buffer.from('new-png-data'),
      originalFilename: 'new-icon.png',
      mimeType: 'image/png',
    })

    selectSpy.mockClear()

    const asset = await favicon.resolveFaviconAsset()

    expect(selectSpy).toHaveBeenCalledTimes(1)
    expect(asset.kind).toBe('binary')
    if (asset.kind === 'binary') {
      expect(asset.body.equals(Buffer.from('new-png-data'))).toBe(true)
      expect(asset.contentType).toBe('image/png')
    }
  })

  it('URL 更新后会清空缓存，下一次读取重新查库并返回新目标地址', async () => {
    const selectSpy = vi.spyOn(testDb, 'select')

    await favicon.resolveFaviconAsset()
    expect(selectSpy).toHaveBeenCalledTimes(1)

    await favicon.saveFaviconUrl('https://cdn.example.com/next-favicon.png')

    selectSpy.mockClear()

    const asset = await favicon.resolveFaviconAsset()

    expect(selectSpy).toHaveBeenCalledTimes(1)
    expect(asset).toEqual({
      kind: 'redirect',
      location: 'https://cdn.example.com/next-favicon.png',
      etag: expect.any(String),
    })
  })

  it('upload 模式在 TTL 内不会重复构建图标资产', async () => {
    await favicon.saveUploadedFavicon({
      buffer: Buffer.from('cached-png-data'),
      originalFilename: 'cached-icon.png',
      mimeType: 'image/png',
    })

    const selectSpy = vi.spyOn(testDb, 'select')

    const first = await favicon.resolveFaviconAsset()
    const second = await favicon.resolveFaviconAsset()

    expect(selectSpy).toHaveBeenCalledTimes(1)
    expect(second).toBe(first)
  })

  it('default 模式不会重复读取默认图标文件', async () => {
    const actualFs = await vi.importActual<typeof import('fs/promises')>('fs/promises')
    const readFileSpy = vi.fn(actualFs.readFile.bind(actualFs))

    vi.doMock('fs/promises', () => ({
      __esModule: true,
      ...actualFs,
      default: {
        ...actualFs,
        readFile: readFileSpy,
      },
      readFile: readFileSpy,
    }))

    vi.resetModules()
    favicon = await import('./favicon')

    const first = await favicon.resolveFaviconAsset()
    favicon.clearFaviconCache()
    const second = await favicon.resolveFaviconAsset()

    expect(readFileSpy).toHaveBeenCalledTimes(1)
    expect(first.kind).toBe('binary')
    expect(second.kind).toBe('binary')
  })
})
