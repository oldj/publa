/**
 * 服务端 Markdown 渲染
 * 使用懒加载避免在构建期提前解析旧式 CJS 插件
 */
import { EMBED_HOSTNAMES } from '@/components/editors/embed/providers'
import MarkdownIt from 'markdown-it'
import sanitizeHtml from 'sanitize-html'

let markdownRendererPromise: Promise<MarkdownIt> | null = null

async function getMarkdownRenderer(): Promise<MarkdownIt> {
  if (!markdownRendererPromise) {
    markdownRendererPromise = (async () => {
      const [{ default: markdownItImsize }, { default: markdownItMathjax }] = await Promise.all([
        import('markdown-it-imsize'),
        import('markdown-it-mathjax'),
      ])

      return new MarkdownIt({
        html: true,
        breaks: true,
      })
        .use(markdownItImsize)
        .use(markdownItMathjax())
    })()
  }

  return markdownRendererPromise
}

/** sanitize-html 白名单配置，保留博客常用标签 */
export const sanitizeOptions: sanitizeHtml.IOptions = {
  allowedTags: sanitizeHtml.defaults.allowedTags.concat([
    'img',
    'details',
    'summary',
    'del',
    'ins',
    'video',
    'audio',
    'source',
    'iframe',
    'math',
    'mi',
    'mo',
    'mn',
    'ms',
    'mrow',
    'msup',
    'msub',
    'mfrac',
    'munder',
    'mover',
    'msqrt',
    'mtable',
    'mtr',
    'mtd',
    'mtext',
    'annotation',
    'semantics',
    'colgroup',
    'col',
  ]),
  allowedAttributes: {
    ...sanitizeHtml.defaults.allowedAttributes,
    img: ['src', 'srcset', 'alt', 'title', 'width', 'height', 'loading', 'data-align'],
    a: ['href', 'title', 'target', 'rel'],
    video: ['src', 'controls', 'width', 'height', 'poster'],
    audio: ['src', 'controls'],
    source: ['src', 'type'],
    iframe: [
      'src',
      'width',
      'height',
      'frameborder',
      'allowfullscreen',
      'allow',
      'sandbox',
      'loading',
      'referrerpolicy',
      'title',
    ],
    table: ['style'],
    col: ['style', 'width'],
    td: ['align', 'valign', 'colspan', 'rowspan', 'style'],
    th: ['align', 'valign', 'colspan', 'rowspan', 'style'],
    span: ['class', 'style'],
    div: ['class', 'style', 'data-embed', 'data-provider', 'data-aspect-ratio', 'data-origin'],
    code: ['class'],
    pre: ['class'],
    math: ['xmlns'],
  },
  allowedStyles: {
    '*': {
      color: [/.*/],
      'background-color': [/.*/],
      'text-align': [/.*/],
      width: [/.*/],
      'min-width': [/.*/],
      'max-width': [/.*/],
      'aspect-ratio': [/.*/],
      'min-height': [/.*/],
      'margin-left': [/^auto$/],
      'margin-right': [/^auto$/],
    },
  },
  allowedSchemes: ['http', 'https', 'mailto'],
  // 保留 www.youtube.com 是为兼容历史 Markdown；其余从 providers.ts 自动派生
  allowedIframeHostnames: ['www.youtube.com', ...EMBED_HOSTNAMES],
}

/** 渲染 Markdown 为 HTML（含 XSS 净化） */
export async function renderMarkdown(content: string): Promise<string> {
  const md = await getMarkdownRenderer()
  const raw = md.render(content)
  return sanitizeHtml(raw, sanitizeOptions)
}

/** 从 HTML 中提取纯文本 */
export function htmlToText(html: string): string {
  return html
    .replace(/<[^>]+>/g, '')
    .replace(/\s+/g, ' ')
    .trim()
}
