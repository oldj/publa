import { describe, expect, it } from 'vitest'
import { pickDiffText } from './diff-content'

describe('pickDiffText', () => {
  it('富文本取 contentHtml 并格式化拆行', () => {
    expect(
      pickDiffText({
        contentType: 'richtext',
        contentRaw: '<p>a</p><p>b</p>',
        contentHtml: '<p>a</p><p>b</p>',
      }),
    ).toBe('<p>a</p>\n<p>b</p>')
  })

  it('markdown 取 contentRaw 原文（contentHtml 为空也不受影响）', () => {
    expect(
      pickDiffText({ contentType: 'markdown', contentRaw: '# 标题\n\n正文', contentHtml: '' }),
    ).toBe('# 标题\n\n正文')
  })

  it('html 源码模式取 contentRaw 原文，保持原样不再格式化', () => {
    const raw = '<div>\n  <p>hi</p>\n</div>'
    expect(pickDiffText({ contentType: 'html', contentRaw: raw, contentHtml: raw })).toBe(raw)
  })

  it('字段缺失时退化为空字符串', () => {
    expect(
      pickDiffText({
        contentType: 'richtext',
        contentRaw: '',
        contentHtml: undefined as unknown as string,
      }),
    ).toBe('')
  })
})
