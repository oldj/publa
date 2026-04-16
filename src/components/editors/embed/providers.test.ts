import { describe, expect, it } from 'vitest'
import {
  EMBED_HOSTNAMES,
  PROVIDERS,
  buildEmbedStyle,
  detectProvider,
  extractTwitterHeight,
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

  it('auto 宽高比输出 min-height + max-width 居中', () => {
    const p = getProviderById('twitter')!
    const style = buildEmbedStyle(p)
    expect(style).toContain('min-height:300px')
    expect(style).toContain('max-width:550px')
    expect(style).toContain('margin-left:auto')
    expect(style).toContain('margin-right:auto')
  })

  it('无 aspectRatio 时输出空串', () => {
    const style = buildEmbedStyle({ id: 'x', match: /x/, toEmbedSrc: () => '', hostname: '' })
    expect(style).toBe('')
  })
})

describe('extractTwitterHeight', () => {
  it('格式 1：{"twttr.private.resize":[{height}]}', () => {
    expect(extractTwitterHeight({ 'twttr.private.resize': [{ height: 512.4 }] })).toBe(513)
  })

  it('格式 2：{method, params}', () => {
    expect(
      extractTwitterHeight({ method: 'twttr.private.resize', params: [{ height: 400 }] }),
    ).toBe(400)
  })

  it('格式 3：{height}', () => {
    expect(extractTwitterHeight({ height: 350 })).toBe(350)
  })

  it('JSON 字符串也能解析', () => {
    expect(extractTwitterHeight('{"twttr.private.resize":[{"height":600}]}')).toBe(600)
  })

  it('无关消息返回 null', () => {
    expect(extractTwitterHeight('hello')).toBeNull()
    expect(extractTwitterHeight(null)).toBeNull()
    expect(extractTwitterHeight({})).toBeNull()
    expect(extractTwitterHeight({ foo: 'bar' })).toBeNull()
  })

  it('height 为字符串时返回 null（仅接受 number）', () => {
    expect(extractTwitterHeight({ height: '400px' })).toBeNull()
  })

  it('向上取整小数高度', () => {
    expect(extractTwitterHeight({ height: 399.1 })).toBe(400)
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
