import { describe, expect, it } from 'vitest'
import wrapBlockMath from './wrapBlockMath'

describe('wrapBlockMath', () => {
  // ── TipTap 行内 / 块级公式节点 ──

  it('TipTap 行内公式 span 被注入 KaTeX 渲染产物', () => {
    const html = '<span data-type="inline-math" data-latex="x^2"></span>'
    const result = wrapBlockMath(html)
    expect(result).toContain('class="katex"')
    expect(result).toContain('data-type="inline-math"')
    expect(result).toContain('data-latex="x^2"')
  })

  it('TipTap 块级公式 div 渲染为 displayMode（输出 katex-display）', () => {
    const html = '<div data-type="block-math" data-latex="\\sum_{i=0}^n i"></div>'
    const result = wrapBlockMath(html)
    expect(result).toContain('katex-display')
    expect(result).toContain('data-type="block-math"')
    expect(result).toContain('data-latex="\\sum_{i=0}^n i"')
  })

  it('已含 .katex 子节点的 TipTap 节点跳过（幂等）', () => {
    const html =
      '<span data-type="inline-math" data-latex="x^2"><span class="katex">cached</span></span>'
    const result = wrapBlockMath(html)
    expect(result).toBe(html)
  })

  it('两次执行结果与一次相同（幂等）', () => {
    const html = '<span data-type="inline-math" data-latex="x^2"></span>'
    const once = wrapBlockMath(html)
    const twice = wrapBlockMath(once)
    expect(twice).toBe(once)
  })

  // ── Markdown 分隔符 ──

  it('文本中 \\(..\\) 被识别为行内公式', () => {
    const html = '<p>x = \\(x^2\\) end</p>'
    const result = wrapBlockMath(html)
    expect(result).toContain('class="katex"')
    expect(result).not.toContain('class="katex-display"')
    expect(result).not.toContain('\\(x^2\\)')
    expect(result).toContain('end')
  })

  it('文本中 \\[..\\] 被识别为块级公式', () => {
    const html = '<p>foo \\[\\sum\\] bar</p>'
    const result = wrapBlockMath(html)
    expect(result).toContain('katex-display')
    expect(result).not.toContain('\\[\\sum\\]')
  })

  it('一段文本中多个分隔符各自渲染', () => {
    const html = '<p>\\(a\\) and \\(b\\)</p>'
    const result = wrapBlockMath(html)
    const matches = result.match(/class="katex"/g) || []
    expect(matches.length).toBeGreaterThanOrEqual(2)
    expect(result).toContain(' and ')
  })

  it('跳过 <pre> / <code> 内的分隔符', () => {
    const pre = '<pre>code: \\(x^2\\)</pre>'
    const code = '<code>raw \\(y\\)</code>'
    expect(wrapBlockMath(pre)).toBe(pre)
    expect(wrapBlockMath(code)).toBe(code)
  })

  // ── 表格内 / 嵌套 ──

  it('表格单元格内的 TipTap 行内公式同样渲染', () => {
    const html =
      '<table><tbody><tr><td><p>x = <span data-type="inline-math" data-latex="x^2"></span></p></td></tr></tbody></table>'
    const result = wrapBlockMath(html)
    expect(result).toContain('class="katex"')
    expect(result).toContain('<td>')
  })

  it('表格单元格文本中的 \\(..\\) 同样渲染', () => {
    const html = '<table><tbody><tr><td><p>\\(x^2\\)</p></td></tr></tbody></table>'
    const result = wrapBlockMath(html)
    expect(result).toContain('class="katex"')
    expect(result).not.toContain('\\(x^2\\)')
  })

  it('混合：TipTap 节点与文本分隔符共存于同一段落', () => {
    const html = '<p>a \\(x\\) b <span data-type="inline-math" data-latex="y"></span> c</p>'
    const result = wrapBlockMath(html)
    const matches = result.match(/class="katex"/g) || []
    expect(matches.length).toBeGreaterThanOrEqual(2)
  })

  // ── 边界 ──

  it('空字符串返回空字符串', () => {
    expect(wrapBlockMath('')).toBe('')
  })

  it('无公式标记的 HTML 原样返回（快速短路）', () => {
    const html = '<p>hello world</p><h2>标题</h2>'
    expect(wrapBlockMath(html)).toBe(html)
  })

  it('空 latex 不渲染', () => {
    const html = '<span data-type="inline-math" data-latex=""></span>'
    const result = wrapBlockMath(html)
    expect(result).toBe(html)
  })

  it('错误的 LaTeX 不抛异常（throwOnError: false）', () => {
    const html = '<span data-type="inline-math" data-latex="\\unknown"></span>'
    expect(() => wrapBlockMath(html)).not.toThrow()
  })
})
