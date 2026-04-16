import { describe, expect, it } from 'vitest'
import wrapBlockImages from './wrapBlockImages'

describe('wrapBlockImages', () => {
  // ── 基本包裹 ──

  it('顶层 img 被包裹在 p.post-detail-img 中', () => {
    const html = '<p>文字</p><img src="a.jpg"><p>文字</p>'
    const result = wrapBlockImages(html)
    expect(result).toBe(
      '<p>文字</p><p class="post-detail-img"><img src="a.jpg"></p><p>文字</p>',
    )
  })

  it('传递 data-align 到容器', () => {
    const html = '<p>文字</p><img src="a.jpg" data-align="center"><p>文字</p>'
    const result = wrapBlockImages(html)
    expect(result).toContain('<p class="post-detail-img" data-align="center">')
    expect(result).toContain('<img src="a.jpg" data-align="center">')
  })

  it('data-align="right" 正确传递', () => {
    const html = '<img src="a.jpg" data-align="right">'
    const result = wrapBlockImages(html)
    expect(result).toBe(
      '<p class="post-detail-img" data-align="right"><img src="a.jpg" data-align="right"></p>',
    )
  })

  it('无 data-align 的顶层 img 不带 data-align 属性', () => {
    const html = '<img src="a.jpg">'
    const result = wrapBlockImages(html)
    expect(result).toBe('<p class="post-detail-img"><img src="a.jpg"></p>')
    expect(result).not.toContain('data-align')
  })

  // ── 连续多张图片 ──

  it('连续多张顶层 img 分别包裹', () => {
    const html = '<img src="a.jpg"><img src="b.jpg"><img src="c.jpg">'
    const result = wrapBlockImages(html)
    expect(result).toBe(
      '<p class="post-detail-img"><img src="a.jpg"></p>' +
        '<p class="post-detail-img"><img src="b.jpg"></p>' +
        '<p class="post-detail-img"><img src="c.jpg"></p>',
    )
  })

  it('连续图片各自保留 data-align', () => {
    const html = '<img src="a.jpg" data-align="center"><img src="b.jpg" data-align="right">'
    const result = wrapBlockImages(html)
    expect(result).toContain('<p class="post-detail-img" data-align="center">')
    expect(result).toContain('<p class="post-detail-img" data-align="right">')
  })

  // ── 不应包裹的情况：img 已在容器内 ──

  it('不包裹 <p> 内的 img', () => {
    const html = '<p><img src="a.jpg"></p>'
    const result = wrapBlockImages(html)
    expect(result).toBe(html)
  })

  it('不包裹 <a> 内的 img', () => {
    const html = '<a href="/link"><img src="a.jpg"></a>'
    const result = wrapBlockImages(html)
    expect(result).toBe(html)
  })

  it('不包裹 <figure> 内的 img', () => {
    const html = '<figure><img src="a.jpg"><figcaption>说明</figcaption></figure>'
    const result = wrapBlockImages(html)
    expect(result).toBe(html)
  })

  it('不包裹 <picture> 内的 img', () => {
    const html = '<picture><source srcset="a.webp" type="image/webp"><img src="a.jpg"></picture>'
    const result = wrapBlockImages(html)
    expect(result).toBe(html)
  })

  it('不包裹 <td> 内的 img', () => {
    const html = '<table><tr><td><img src="a.jpg"></td></tr></table>'
    const result = wrapBlockImages(html)
    expect(result).toBe(html)
  })

  it('不包裹 <th> 内的 img', () => {
    const html = '<table><tr><th><img src="a.jpg"></th></tr></table>'
    const result = wrapBlockImages(html)
    expect(result).toBe(html)
  })

  it('不包裹 <li> 内的 img', () => {
    const html = '<ul><li><img src="a.jpg"></li></ul>'
    const result = wrapBlockImages(html)
    expect(result).toBe(html)
  })

  it('不包裹 <span> 内的 img', () => {
    const html = '<span><img src="a.jpg"></span>'
    const result = wrapBlockImages(html)
    expect(result).toBe(html)
  })

  // ── 关键边界：img 前有同级行内标签（正则方案会误判的场景） ──

  it('不包裹 <p> 内、前面有 <strong> 等行内标签的 img', () => {
    const html = '<p>文字 <strong>加粗</strong> <img src="a.jpg"></p>'
    const result = wrapBlockImages(html)
    expect(result).toBe(html)
  })

  it('不包裹 <p> 内、前面有 <a> 链接的 img', () => {
    const html = '<p>文字 <a href="/">链接</a> <img src="a.jpg"></p>'
    const result = wrapBlockImages(html)
    expect(result).toBe(html)
  })

  it('不包裹 <p> 内纯文本后的 img', () => {
    const html = '<p>文字 <img src="a.jpg"> 更多文字</p>'
    const result = wrapBlockImages(html)
    expect(result).toBe(html)
  })

  // ── 混合场景 ──

  it('同一段 HTML 中顶层 img 包裹、容器内 img 不动', () => {
    const html = '<p><img src="inline.jpg"></p><img src="block.jpg"><p>尾部</p>'
    const result = wrapBlockImages(html)
    expect(result).toBe(
      '<p><img src="inline.jpg"></p>' +
        '<p class="post-detail-img"><img src="block.jpg"></p>' +
        '<p>尾部</p>',
    )
  })

  it('img 在 <div> 内但不在容器标签内 → 包裹', () => {
    const html = '<div><img src="a.jpg"></div>'
    const result = wrapBlockImages(html)
    expect(result).toBe('<div><p class="post-detail-img"><img src="a.jpg"></p></div>')
  })

  it('img 在 <blockquote> 内顶层 → 包裹', () => {
    const html = '<blockquote><img src="a.jpg"></blockquote>'
    const result = wrapBlockImages(html)
    expect(result).toBe(
      '<blockquote><p class="post-detail-img"><img src="a.jpg"></p></blockquote>',
    )
  })

  // ── 保留其他属性 ──

  it('img 的 width/height/alt 等属性保持不变', () => {
    const html = '<img src="a.jpg" width="300" height="200" alt="图片" loading="lazy">'
    const result = wrapBlockImages(html)
    expect(result).toContain('width="300"')
    expect(result).toContain('height="200"')
    expect(result).toContain('alt="图片"')
    expect(result).toContain('loading="lazy"')
  })

  // ── 空输入与无 img ──

  it('空字符串返回空字符串', () => {
    expect(wrapBlockImages('')).toBe('')
  })

  it('无 img 的 HTML 原样返回', () => {
    const html = '<p>没有图片</p><h2>标题</h2>'
    expect(wrapBlockImages(html)).toBe(html)
  })

  // ── 典型 TipTap 富文本编辑器输出 ──

  it('TipTap 块级图片输出格式', () => {
    const html =
      '<h2>标题</h2><p>正文段落</p><img src="photo.jpg" data-align="center" width="600"><p>后续段落</p>'
    const result = wrapBlockImages(html)
    expect(result).toBe(
      '<h2>标题</h2><p>正文段落</p>' +
        '<p class="post-detail-img" data-align="center"><img src="photo.jpg" data-align="center" width="600"></p>' +
        '<p>后续段落</p>',
    )
  })

  // ── Markdown 渲染输出（img 在 <p> 内）──

  it('Markdown 渲染的 <p><img></p> 不二次包裹', () => {
    const html = '<p><img src="photo.jpg" alt="描述"></p>'
    const result = wrapBlockImages(html)
    expect(result).toBe(html)
  })
})
