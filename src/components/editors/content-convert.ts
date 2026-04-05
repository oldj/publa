import TurndownService from 'turndown'

export type ContentType = 'richtext' | 'markdown' | 'html'

const turndown = new TurndownService({ headingStyle: 'atx', codeBlockStyle: 'fenced' })

let markdownRenderer: { render: (content: string) => string } | null = null

/** 将 Markdown 渲染为 HTML（客户端，懒加载 markdown-it） */
export async function renderMarkdownToHtml(content: string): Promise<string> {
  if (!markdownRenderer) {
    const { default: MarkdownIt } = await import('markdown-it')
    markdownRenderer = new MarkdownIt({ html: true, breaks: true })
  }
  return markdownRenderer.render(content)
}

/** 将 HTML 转为 Markdown */
export function htmlToMarkdown(html: string): string {
  return turndown.turndown(html)
}
