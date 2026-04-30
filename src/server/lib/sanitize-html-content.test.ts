import { describe, expect, it } from 'vitest'
import { sanitizeRichTextHtml } from './sanitize-html-content'

describe('sanitizeRichTextHtml', () => {
  it('null / undefined / 空串返回空串', () => {
    expect(sanitizeRichTextHtml(null)).toBe('')
    expect(sanitizeRichTextHtml(undefined)).toBe('')
    expect(sanitizeRichTextHtml('')).toBe('')
  })

  it('保留常规 HTML 标签', () => {
    const html = '<p>Hello <strong>world</strong></p>'
    expect(sanitizeRichTextHtml(html)).toBe(html)
  })

  it('保留图片标签及属性', () => {
    const html = '<img src="https://example.com/a.jpg" alt="photo" width="200" />'
    const result = sanitizeRichTextHtml(html)
    expect(result).toContain('src="https://example.com/a.jpg"')
    expect(result).toContain('alt="photo"')
  })

  it('剥离 script 标签', () => {
    const html = '<p>safe</p><script>alert("xss")</script>'
    const result = sanitizeRichTextHtml(html)
    expect(result).not.toContain('<script')
    expect(result).toContain('<p>safe</p>')
  })

  it('剥离 onerror 等事件属性', () => {
    const html = '<img src="x" onerror="alert(1)" />'
    const result = sanitizeRichTextHtml(html)
    expect(result).not.toContain('onerror')
  })

  it('剥离 javascript: 协议', () => {
    const html = '<a href="javascript:alert(1)">click</a>'
    const result = sanitizeRichTextHtml(html)
    expect(result).not.toContain('javascript:')
  })

  // embed 相关
  it('保留白名单内 iframe（youtube-nocookie）', () => {
    const html =
      '<iframe src="https://www.youtube-nocookie.com/embed/abc123" loading="lazy" allow="fullscreen"></iframe>'
    const result = sanitizeRichTextHtml(html)
    expect(result).toContain('src="https://www.youtube-nocookie.com/embed/abc123"')
    expect(result).toContain('loading="lazy"')
    expect(result).toContain('allow="fullscreen"')
  })

  it('剥离非白名单域名的 iframe', () => {
    const html = '<iframe src="https://evil.com/payload"></iframe>'
    const result = sanitizeRichTextHtml(html)
    expect(result).not.toContain('evil.com')
  })

  it('保留 embed 容器的 data-* 属性', () => {
    const html =
      '<div data-embed="" data-provider="youtube" data-aspect-ratio="16/9" data-origin="https://youtube.com/watch?v=abc" class="embed"><iframe src="https://www.youtube-nocookie.com/embed/abc"></iframe></div>'
    const result = sanitizeRichTextHtml(html)
    // sanitize-html 对空值布尔属性输出 data-embed（不带 =""）
    expect(result).toMatch(/data-embed/)
    expect(result).toContain('data-provider="youtube"')
    expect(result).toContain('data-aspect-ratio="16/9"')
    expect(result).toContain('data-origin="https://youtube.com/watch?v=abc"')
  })

  it('保留 div 的 style 中 aspect-ratio 和 min-height', () => {
    const html = '<div style="aspect-ratio:16/9"></div>'
    const result = sanitizeRichTextHtml(html)
    expect(result).toContain('aspect-ratio')
  })

  it('保留 max-width 和 margin-left/right:auto（居中布局）', () => {
    const html = '<div style="max-width:550px;margin-left:auto;margin-right:auto"></div>'
    const result = sanitizeRichTextHtml(html)
    expect(result).toContain('max-width')
    expect(result).toContain('margin-left:auto')
    expect(result).toContain('margin-right:auto')
  })

  it('剥离 margin-left 非 auto 值', () => {
    const html = '<div style="margin-left:10px"></div>'
    const result = sanitizeRichTextHtml(html)
    expect(result).not.toContain('margin-left')
  })

  it('幂等：净化后再净化结果不变', () => {
    const html =
      '<div data-embed="" data-provider="bilibili" class="embed"><iframe src="https://player.bilibili.com/player.html?bvid=BV1xx" allow="fullscreen" loading="lazy"></iframe></div>'
    const first = sanitizeRichTextHtml(html)
    const second = sanitizeRichTextHtml(first)
    expect(second).toBe(first)
  })

  // 数学公式（TipTap @tiptap/extension-mathematics）
  it('保留行内公式 span 的 data-type / data-latex 属性', () => {
    const html = '<span data-type="inline-math" data-latex="x^2">x²</span>'
    const result = sanitizeRichTextHtml(html)
    expect(result).toContain('data-type="inline-math"')
    expect(result).toContain('data-latex="x^2"')
  })

  it('保留块级公式 div 的 data-type / data-latex 属性', () => {
    const html = '<div data-type="block-math" data-latex="\\sum_{i=0}^n i">…</div>'
    const result = sanitizeRichTextHtml(html)
    expect(result).toContain('data-type="block-math"')
    expect(result).toContain('data-latex="\\sum_{i=0}^n i"')
  })

  it('表格单元格内嵌行内公式仍保留属性', () => {
    const html =
      '<table><tbody><tr><td><p>x = <span data-type="inline-math" data-latex="x^2">x²</span></p></td></tr></tbody></table>'
    const result = sanitizeRichTextHtml(html)
    expect(result).toContain('data-type="inline-math"')
    expect(result).toContain('data-latex="x^2"')
    expect(result).toContain('<td>')
  })

  it('空内容的行内/块级公式标签保留属性（TipTap atom 节点 renderHTML 不输出 children）', () => {
    const inline = '<span data-type="inline-math" data-latex="x^2"></span>'
    const block = '<div data-type="block-math" data-latex="\\sum"></div>'
    const inlineOut = sanitizeRichTextHtml(inline)
    const blockOut = sanitizeRichTextHtml(block)
    expect(inlineOut).toContain('data-type="inline-math"')
    expect(inlineOut).toContain('data-latex="x^2"')
    expect(blockOut).toContain('data-type="block-math"')
    expect(blockOut).toContain('data-latex="\\sum"')
  })

  it('未列入白名单的 data-* 属性仍被剥离', () => {
    const html = '<span data-foo="bar" data-type="inline-math">x</span>'
    const result = sanitizeRichTextHtml(html)
    expect(result).not.toContain('data-foo')
    expect(result).toContain('data-type="inline-math"')
  })

  it('保留 bilibili / vimeo / twitter / codepen / codesandbox 域名的 iframe', () => {
    const hostnames = [
      'player.bilibili.com',
      'player.vimeo.com',
      'platform.twitter.com',
      'codepen.io',
      'codesandbox.io',
    ]
    for (const hostname of hostnames) {
      const html = `<iframe src="https://${hostname}/embed/123"></iframe>`
      const result = sanitizeRichTextHtml(html)
      expect(result).toContain(hostname)
    }
  })
})
