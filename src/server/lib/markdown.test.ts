import wrapBlockMath from '@/lib/wrapBlockMath'
import { describe, expect, it } from 'vitest'
import { renderMarkdown } from './markdown'

describe('Markdown 渲染兼容性', () => {
  it('保留标题、表格、代码和显式链接', async () => {
    const html = await renderMarkdown(
      '# 标题\n\n[链接](https://example.com)\n\n| 列 |\n| --- |\n| 内容 |\n\n```js\nconst x = 1\n```',
    )

    expect(html).toContain('<h1>标题</h1>')
    expect(html).toContain('<a href="https://example.com">链接</a>')
    expect(html).toContain('<th>列</th>')
    expect(html).toContain('<td>内容</td>')
    expect(html).toContain('<code class="language-js">const x = 1\n</code>')
  })

  it('图片尺寸插件仍可生成宽高属性', async () => {
    const html = await renderMarkdown('![示例](https://example.com/image.png =320x180)')

    expect(html).toContain('src="https://example.com/image.png"')
    expect(html).toContain('alt="示例"')
    expect(html).toContain('width="320"')
    expect(html).toContain('height="180"')
  })

  it('数学插件生成的行内和块级公式可继续由 KaTeX 渲染', async () => {
    const html = await renderMarkdown('$x^2$\n\n$$\n\\frac{1}{2}\n$$')
    const rendered = wrapBlockMath(html)

    expect(html).toContain('\\(x^2\\)')
    expect(html).toContain('\\[')
    expect(rendered).toContain('class="katex"')
    expect(rendered).toContain('katex-display')
    expect(rendered).not.toContain('katex-error')
    expect(wrapBlockMath(rendered)).toBe(rendered)
  })

  it('净化脚本、事件属性和危险链接', async () => {
    const html = await renderMarkdown(
      '<script>alert(1)</script>\n\n<img src="https://example.com/a.png" onerror="alert(1)">\n\n<a href="javascript:alert(1)">危险链接</a>',
    )

    expect(html).not.toContain('<script')
    expect(html).not.toContain('onerror')
    expect(html).not.toContain('javascript:')
    expect(html).toContain('危险链接')
  })
})
