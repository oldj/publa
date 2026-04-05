/**
 * 服务端 Markdown 渲染
 * 使用懒加载避免在构建期提前解析旧式 CJS 插件
 */
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
const sanitizeOptions: sanitizeHtml.IOptions = {
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
    img: ['src', 'srcset', 'alt', 'title', 'width', 'height', 'loading'],
    a: ['href', 'title', 'target', 'rel'],
    video: ['src', 'controls', 'width', 'height', 'poster'],
    audio: ['src', 'controls'],
    source: ['src', 'type'],
    iframe: ['src', 'width', 'height', 'frameborder', 'allowfullscreen'],
    table: ['style'],
    col: ['style', 'width'],
    td: ['align', 'valign', 'colspan', 'rowspan', 'style'],
    th: ['align', 'valign', 'colspan', 'rowspan', 'style'],
    span: ['class', 'style'],
    div: ['class', 'style'],
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
    },
  },
  allowedSchemes: ['http', 'https', 'mailto'],
  allowedIframeHostnames: ['www.youtube.com', 'player.bilibili.com'],
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
