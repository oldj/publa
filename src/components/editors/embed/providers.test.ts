import { describe, expect, it } from 'vitest'
import {
  EMBED_HOSTNAMES,
  PROVIDERS,
  buildEmbedStyle,
  detectProvider,
  getProviderById,
} from './providers'

describe('detectProvider', () => {
  const cases: [string, string, string][] = [
    // [输入 URL, 期望 provider id, 期望 src 片段]
    ['https://www.youtube.com/watch?v=dQw4w9WgXcQ', 'youtube', 'youtube-nocookie.com/embed/dQw4w9WgXcQ'],
    ['https://youtu.be/dQw4w9WgXcQ', 'youtube', 'youtube-nocookie.com/embed/dQw4w9WgXcQ'],
    ['https://www.youtube.com/shorts/abcdef123456', 'youtube', 'youtube-nocookie.com/embed/abcdef123456'],
    ['https://www.youtube.com/embed/dQw4w9WgXcQ', 'youtube', 'youtube-nocookie.com/embed/dQw4w9WgXcQ'],
    ['https://www.bilibili.com/video/BV1xx411c7mu', 'bilibili', 'player.bilibili.com/player.html?bvid=BV1xx411c7mu'],
    ['https://vimeo.com/123456789', 'vimeo', 'player.vimeo.com/video/123456789'],
    ['https://vimeo.com/video/123456789', 'vimeo', 'player.vimeo.com/video/123456789'],
    ['https://twitter.com/user/status/1234567890', 'twitter', 'platform.twitter.com/embed/Tweet.html?id=1234567890'],
    ['https://x.com/user/status/1234567890', 'twitter', 'platform.twitter.com/embed/Tweet.html?id=1234567890'],
    ['https://codepen.io/user/pen/abcDEF', 'codepen', 'codepen.io/user/embed/abcDEF'],
    ['https://codesandbox.io/s/my-sandbox-abc', 'codesandbox', 'codesandbox.io/embed/my-sandbox-abc'],
    ['https://codesandbox.io/p/sandbox/my-sandbox', 'codesandbox', 'codesandbox.io/embed/my-sandbox'],
  ]

  it.each(cases)('%s → provider=%s', (url, expectedId, srcFragment) => {
    const result = detectProvider(url)
    expect(result).not.toBeNull()
    expect(result!.provider.id).toBe(expectedId)
    expect(result!.src).toContain(srcFragment)
  })

  it('前后空格不影响匹配', () => {
    const result = detectProvider('  https://youtu.be/abc123ABC  ')
    expect(result).not.toBeNull()
    expect(result!.provider.id).toBe('youtube')
  })

  it('不支持的站点返回 null', () => {
    expect(detectProvider('https://example.com/video/123')).toBeNull()
    expect(detectProvider('https://www.tiktok.com/@user/video/123')).toBeNull()
  })

  it('空字符串返回 null', () => {
    expect(detectProvider('')).toBeNull()
    expect(detectProvider('   ')).toBeNull()
  })

  it('生成的 src 一定是 https', () => {
    for (const [url] of cases) {
      const result = detectProvider(url)
      expect(result!.src).toMatch(/^https:\/\//)
    }
  })
})

describe('getProviderById', () => {
  it('已注册 id 返回对应 provider', () => {
    const p = getProviderById('youtube')
    expect(p).not.toBeNull()
    expect(p!.id).toBe('youtube')
    expect(p!.hostname).toBe('www.youtube-nocookie.com')
  })

  it('未注册 id 返回 null', () => {
    expect(getProviderById('tiktok')).toBeNull()
  })

  it('null / undefined / 空串返回 null', () => {
    expect(getProviderById(null)).toBeNull()
    expect(getProviderById(undefined)).toBeNull()
    expect(getProviderById('')).toBeNull()
  })
})

describe('buildEmbedStyle', () => {
  it('固定宽高比输出 aspect-ratio', () => {
    const p = getProviderById('youtube')!
    expect(buildEmbedStyle(p)).toBe('aspect-ratio:16/9')
  })

  it('auto 宽高比输出 min-height', () => {
    const p = getProviderById('twitter')!
    expect(buildEmbedStyle(p)).toBe('min-height:420px')
  })

  it('无 aspectRatio 时输出空串', () => {
    const style = buildEmbedStyle({ id: 'x', match: /x/, toEmbedSrc: () => '', hostname: '' })
    expect(style).toBe('')
  })
})

describe('EMBED_HOSTNAMES', () => {
  it('包含所有 provider 的 hostname 且无重复', () => {
    const hostnames = PROVIDERS.map((p) => p.hostname)
    for (const h of hostnames) {
      expect(EMBED_HOSTNAMES).toContain(h)
    }
    expect(EMBED_HOSTNAMES.length).toBe(new Set(hostnames).size)
  })
})
