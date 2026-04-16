/**
 * 第三方嵌入站点注册表
 *
 * 本文件同时被客户端（EmbedNode/Popover/View）和服务端（markdown.ts 取 EMBED_HOSTNAMES）引用，
 * 必须保持为纯 TS：禁止 import 浏览器 API（window/document）、禁止加 'use client'，
 * 也不要引入仅服务端可用的模块。如需拆分显示用逻辑与白名单常量，请另建文件，别污染这里。
 *
 * 新增站点的步骤：
 * 1. 在 PROVIDERS 数组尾部追加一条 Provider
 * 2. 在 src/messages/{zh,en}/admin.json 的 editor.embedPopover.providers 加一项 [id]: "显示名"
 * 3. 若需要特殊宽高比，在注册项里设置 aspectRatio
 * 无需改 Node、Popover、sanitize 白名单（白名单从 EMBED_HOSTNAMES 自动派生）
 */

export interface Provider {
  /** 稳定字符串 id，用于 i18n key 与 data-provider 属性 */
  id: string
  /** 从原始 URL 抓取视频/内容 id 的正则 */
  match: RegExp
  /** 将匹配结果转换为官方 iframe src */
  toEmbedSrc: (m: RegExpMatchArray) => string
  /** iframe 最终域名，用于 sanitize 白名单 */
  hostname: string
  /** CSS aspect-ratio 值；'auto' 表示高度不定（如 X.com），需配合 minHeight */
  aspectRatio?: string
  /** aspectRatio='auto' 时的最小高度（px） */
  minHeight?: number
  /** 容器最大宽度（px），用于居中显示 */
  maxWidth?: number
  /** 站点特有 iframe 属性覆盖 */
  iframeAttrs?: Record<string, string>
}

export const PROVIDERS: Provider[] = [
  {
    id: 'youtube',
    match: /(?:youtube\.com\/(?:watch\?v=|shorts\/|embed\/)|youtu\.be\/)([A-Za-z0-9_-]{6,20})/i,
    toEmbedSrc: (m) => `https://www.youtube-nocookie.com/embed/${m[1]}`,
    hostname: 'www.youtube-nocookie.com',
    aspectRatio: '16/9',
  },
  {
    id: 'bilibili',
    match: /bilibili\.com\/video\/(BV[A-Za-z0-9]+)/i,
    toEmbedSrc: (m) => `https://player.bilibili.com/player.html?bvid=${m[1]}&autoplay=0`,
    hostname: 'player.bilibili.com',
    aspectRatio: '16/9',
  },
  {
    id: 'vimeo',
    match: /vimeo\.com\/(?:video\/)?(\d+)/i,
    toEmbedSrc: (m) => `https://player.vimeo.com/video/${m[1]}`,
    hostname: 'player.vimeo.com',
    aspectRatio: '16/9',
  },
  {
    id: 'twitter',
    match: /(?:twitter\.com|x\.com)\/[^/]+\/status\/(\d+)/i,
    toEmbedSrc: (m) => `https://platform.twitter.com/embed/Tweet.html?id=${m[1]}&dnt=true`,
    hostname: 'platform.twitter.com',
    aspectRatio: 'auto',
    minHeight: 300,
    /** 推文标准宽度 */
    maxWidth: 550,
  },
  {
    id: 'codepen',
    match: /codepen\.io\/([^/]+)\/(?:pen|full|embed)\/([A-Za-z0-9]+)/i,
    toEmbedSrc: (m) => `https://codepen.io/${m[1]}/embed/${m[2]}?default-tab=result`,
    hostname: 'codepen.io',
    aspectRatio: '16/10',
  },
  {
    id: 'codesandbox',
    match: /codesandbox\.io\/(?:s|embed|p\/sandbox)\/([A-Za-z0-9-]+)/i,
    toEmbedSrc: (m) => `https://codesandbox.io/embed/${m[1]}`,
    hostname: 'codesandbox.io',
    aspectRatio: '16/10',
  },
]

/** sanitize 白名单从注册表派生，保证"注册表 ↔ 白名单"不脱节 */
export const EMBED_HOSTNAMES: string[] = Array.from(new Set(PROVIDERS.map((p) => p.hostname)))

/** 根据原始 URL 识别 provider 并生成 iframe src；不匹配返回 null */
export function detectProvider(url: string): { provider: Provider; src: string } | null {
  const trimmed = url.trim()
  if (!trimmed) return null
  for (const provider of PROVIDERS) {
    const m = trimmed.match(provider.match)
    if (m) return { provider, src: provider.toEmbedSrc(m) }
  }
  return null
}

/** 根据 provider id 查注册项，反查已插入节点的元数据 */
export function getProviderById(id: string | null | undefined): Provider | null {
  if (!id) return null
  return PROVIDERS.find((p) => p.id === id) ?? null
}

/**
 * 从 postMessage 的 data 中提取 Twitter embed 的高度。
 * Twitter 使用多种格式，此函数做宽泛匹配。
 */
export function extractTwitterHeight(raw: unknown): number | null {
  try {
    const data = typeof raw === 'string' ? JSON.parse(raw) : raw
    if (!data || typeof data !== 'object') return null

    // 格式 1：{"twttr.private.resize":[{height}]}
    const resize = (data as Record<string, unknown>)['twttr.private.resize']
    if (Array.isArray(resize) && resize[0]?.height) {
      return Math.ceil(resize[0].height as number)
    }

    // 格式 2：{method:"twttr.private.resize", params:[{height}]}
    if ((data as Record<string, unknown>).method === 'twttr.private.resize') {
      const params = (data as Record<string, unknown>).params
      if (Array.isArray(params) && params[0]?.height) {
        return Math.ceil(params[0].height as number)
      }
    }

    // 格式 3：{height} 或 {"twttr.embed":{height}} 等变体
    if (typeof (data as Record<string, unknown>).height === 'number') {
      return Math.ceil((data as Record<string, unknown>).height as number)
    }
  } catch {
    // 非 JSON，忽略
  }
  return null
}

/** 根据 provider 生成外层容器 inline style，供 renderHTML 使用 */
export function buildEmbedStyle(provider: Provider): string {
  const parts: string[] = []
  if (provider.aspectRatio && provider.aspectRatio !== 'auto') {
    parts.push(`aspect-ratio:${provider.aspectRatio}`)
  }
  if (provider.aspectRatio === 'auto' && provider.minHeight) {
    parts.push(`min-height:${provider.minHeight}px`)
  }
  if (provider.maxWidth) {
    parts.push(`max-width:${provider.maxWidth}px`)
    parts.push('margin-left:auto')
    parts.push('margin-right:auto')
  }
  return parts.join(';')
}
