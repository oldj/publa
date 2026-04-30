import { describe, expect, it } from 'vitest'
import wrapBlockTables from './wrapBlockTables'

describe('wrapBlockTables', () => {
  it('顶层 table 被包裹在 div.rich-table-wrapper 中', () => {
    const html = '<table><tr><td>1</td></tr></table>'
    const result = wrapBlockTables(html)
    expect(result).toBe('<div class="rich-table-wrapper"><table><tr><td>1</td></tr></table></div>')
  })

  it('table 内文字与属性保持原样', () => {
    const html =
      '<table class="x"><thead><tr><th>头</th></tr></thead><tbody><tr><td>体</td></tr></tbody></table>'
    const result = wrapBlockTables(html)
    expect(result).toContain('<table class="x">')
    expect(result).toContain('<th>头</th>')
    expect(result).toContain('<td>体</td>')
    expect(result.startsWith('<div class="rich-table-wrapper">')).toBe(true)
  })

  it('多个 table 各自包裹', () => {
    const html = '<table><tr><td>a</td></tr></table><table><tr><td>b</td></tr></table>'
    const result = wrapBlockTables(html)
    expect(result).toBe(
      '<div class="rich-table-wrapper"><table><tr><td>a</td></tr></table></div>' +
        '<div class="rich-table-wrapper"><table><tr><td>b</td></tr></table></div>',
    )
  })

  it('已被 rich-table-wrapper 包裹的 table 不重复包裹（幂等）', () => {
    const html = '<div class="rich-table-wrapper"><table><tr><td>x</td></tr></table></div>'
    const result = wrapBlockTables(html)
    expect(result).toBe(html)
  })

  it('两次执行结果与一次相同（幂等）', () => {
    const html = '<table><tr><td>1</td></tr></table>'
    const once = wrapBlockTables(html)
    const twice = wrapBlockTables(once)
    expect(twice).toBe(once)
  })

  it('class 名称仅前缀匹配时不视为已包裹', () => {
    const html = '<div class="rich-table-wrapper-other"><table><tr><td>1</td></tr></table></div>'
    const result = wrapBlockTables(html)
    expect(result).toBe(
      '<div class="rich-table-wrapper-other">' +
        '<div class="rich-table-wrapper"><table><tr><td>1</td></tr></table></div>' +
        '</div>',
    )
  })

  it('table 嵌在 div 内的顶层位置 → 包裹', () => {
    const html = '<div><table><tr><td>1</td></tr></table></div>'
    const result = wrapBlockTables(html)
    expect(result).toBe(
      '<div><div class="rich-table-wrapper"><table><tr><td>1</td></tr></table></div></div>',
    )
  })

  it('段落、标题等非 table 内容原样保留', () => {
    const html = '<h2>标题</h2><p>正文</p><table><tr><td>1</td></tr></table><p>尾</p>'
    const result = wrapBlockTables(html)
    expect(result).toBe(
      '<h2>标题</h2><p>正文</p>' +
        '<div class="rich-table-wrapper"><table><tr><td>1</td></tr></table></div>' +
        '<p>尾</p>',
    )
  })

  it('空字符串返回空字符串', () => {
    expect(wrapBlockTables('')).toBe('')
  })

  it('无 table 的 HTML 原样返回', () => {
    const html = '<p>没有表格</p><h2>标题</h2>'
    expect(wrapBlockTables(html)).toBe(html)
  })
})
