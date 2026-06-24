import { describe, expect, it } from 'vitest'
import { formatHtmlForDiff } from './format-html'

describe('formatHtmlForDiff', () => {
  it('空字符串返回空', () => {
    expect(formatHtmlForDiff('')).toBe('')
  })

  it('紧邻的块级标签拆分到独立行', () => {
    expect(formatHtmlForDiff('<p>a</p><p>b</p>')).toBe('<p>a</p>\n<p>b</p>')
  })

  it('保留标签内文本，不拆分非紧邻边界', () => {
    expect(formatHtmlForDiff('<p>foo <strong>bar</strong> baz</p>')).toBe(
      '<p>foo <strong>bar</strong> baz</p>',
    )
  })

  it('保留标签之间的空白（不会被吞掉）', () => {
    // `</a> <a>` 之间的空格在渲染时是有意义的，必须保留
    expect(formatHtmlForDiff('<a>x</a> <a>y</a>')).toBe('<a>x</a> <a>y</a>')
  })

  it('无换行输入：去掉新插入的换行后等于原文', () => {
    const src = '<ul><li>1</li><li>2</li></ul><p>tail</p>'
    expect(formatHtmlForDiff(src).replace(/\n/g, '')).toBe(src)
  })

  it('属性值里的 well-formed 实体不会被误拆（无 `><` 相邻序列）', () => {
    // 合法 HTML 会把属性里的尖括号转义，故 `a > b` 中不含 `><`，输出保持不变
    expect(formatHtmlForDiff('<a href="/x" title="a > b">link</a>')).toBe(
      '<a href="/x" title="a > b">link</a>',
    )
  })

  it('代码块的原有换行被保留，仅在标签边界另插换行', () => {
    // `<pre><code>` 内的真实换行原样保留，标签紧邻处额外插入换行
    expect(formatHtmlForDiff('<pre><code>line1\nline2</code></pre>')).toBe(
      '<pre>\n<code>line1\nline2</code>\n</pre>',
    )
  })
})
