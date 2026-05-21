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

  // SVG 支持（editor 档：走白名单，svg 保留，恶意元素被剥）
  it('保留基本 SVG 结构与属性', () => {
    const html =
      '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="24" height="24"><path d="M12 2L2 22h20L12 2z" fill="red"/></svg>'
    const result = sanitizeRichTextHtml(html)
    expect(result).toContain('<svg')
    expect(result).toContain('<path')
    expect(result).toContain('d="M12 2L2 22h20L12 2z"')
    expect(result).toContain('fill="red"')
  })

  it('剥离 SVG 内的 script 标签', () => {
    const html = '<svg><script>alert("xss")</script><circle cx="10" cy="10" r="5"/></svg>'
    const result = sanitizeRichTextHtml(html)
    expect(result).not.toContain('<script')
    expect(result).toContain('<circle')
  })

  it('剥离 SVG 标签上的 onload / onclick 等事件属性', () => {
    const html = '<svg onload="alert(1)"><rect onclick="hack()" width="10" height="10"/></svg>'
    const result = sanitizeRichTextHtml(html)
    expect(result).not.toContain('onload')
    expect(result).not.toContain('onclick')
    expect(result).toContain('<svg')
    expect(result).toContain('<rect')
  })

  it('剥离 foreignObject（防止任意 HTML 注入）', () => {
    const html =
      '<svg><foreignObject><div onclick="hack()">evil</div></foreignObject><circle cx="5" cy="5" r="3"/></svg>'
    const result = sanitizeRichTextHtml(html)
    expect(result).not.toMatch(/foreignobject/i)
    expect(result).not.toContain('onclick')
  })

  it('剥离 use 标签的 javascript: 协议（通过 allowedSchemes）', () => {
    const html = '<svg><use href="javascript:alert(1)"/></svg>'
    const result = sanitizeRichTextHtml(html)
    expect(result).not.toContain('javascript:')
  })

  it('保留 SVG 渐变定义', () => {
    const html =
      '<svg><defs><linearGradient id="g1"><stop offset="0%" stop-color="red"/><stop offset="100%" stop-color="blue"/></linearGradient></defs><rect width="100" height="100" fill="url(#g1)"/></svg>'
    const result = sanitizeRichTextHtml(html)
    // sanitize-html 会将 camelCase 标签小写为 lineargradient；浏览器在 SVG 上下文中渲染时仍会纠正
    expect(result.toLowerCase()).toContain('<lineargradient')
    expect(result).toContain('<stop')
    expect(result).toContain('stop-color="red"')
    expect(result).toContain('stop-color="blue"')
  })

  it('保留 SVG <title> 子标签（无障碍）', () => {
    const html = '<svg><title>关闭按钮</title><path d="M0 0L10 10"/></svg>'
    const result = sanitizeRichTextHtml(html)
    expect(result).toContain('<title>关闭按钮</title>')
  })

  // style 标签
  it('保留 <style> 标签及内部 CSS', () => {
    const html = '<style>.my-class { color: red; padding: 8px }</style><p class="my-class">x</p>'
    const result = sanitizeRichTextHtml(html)
    expect(result).toContain('<style')
    expect(result).toContain('.my-class')
    expect(result).toContain('color: red')
  })

  it('保留 <style> 的 media 属性', () => {
    const html = '<style media="(prefers-color-scheme: dark)">body{color:#fff}</style>'
    const result = sanitizeRichTextHtml(html)
    expect(result).toContain('media="(prefers-color-scheme: dark)"')
  })

  // inline style 白名单扩展
  it('保留扩展后的 inline style 属性（transform / padding / display / margin）', () => {
    const html =
      '<div style="transform: rotate(5deg); padding: 8px; display: flex; margin: 4px">x</div>'
    const result = sanitizeRichTextHtml(html)
    expect(result).toContain('transform:rotate(5deg)')
    expect(result).toContain('padding:8px')
    expect(result).toContain('display:flex')
    expect(result).toContain('margin:4px')
  })

  it('inline style margin-left 支持任意值（不再限于 auto）', () => {
    const html = '<div style="margin-left: 10px">x</div>'
    const result = sanitizeRichTextHtml(html)
    expect(result).toContain('margin-left:10px')
  })

  // 角色 bypass
  it('role=owner 时跳过净化，原样返回（含 script / 事件属性）', () => {
    const html =
      '<svg onload="alert(1)"><foreignObject><script>evil()</script></foreignObject></svg><script>more()</script>'
    const result = sanitizeRichTextHtml(html, { role: 'owner' })
    expect(result).toBe(html)
  })

  it('role=admin 时跳过净化，原样返回', () => {
    const html = '<style>body{display:none}</style><svg onload="x"></svg>'
    const result = sanitizeRichTextHtml(html, { role: 'admin' })
    expect(result).toBe(html)
  })

  it('role=editor 时仍走白名单（与不传 role 一致）', () => {
    const html = '<p>safe</p><script>alert(1)</script>'
    const withRole = sanitizeRichTextHtml(html, { role: 'editor' })
    const without = sanitizeRichTextHtml(html)
    expect(withRole).toBe(without)
    expect(withRole).not.toContain('<script')
    expect(withRole).toContain('<p>safe</p>')
  })

  // bypassRoles 可注入：覆盖默认的 owner / admin 策略
  it('bypassRoles=[]：所有角色都走净化（即使是 owner）', () => {
    const html = '<svg onload="x"/><script>1</script>'
    const result = sanitizeRichTextHtml(html, { role: 'owner', bypassRoles: [] })
    expect(result).not.toContain('onload')
    expect(result).not.toContain('<script')
  })

  it('bypassRoles=["editor"]：editor 跳过，admin 反而走净化', () => {
    const html = '<script>1</script>'
    const editor = sanitizeRichTextHtml(html, { role: 'editor', bypassRoles: ['editor'] })
    const admin = sanitizeRichTextHtml(html, { role: 'admin', bypassRoles: ['editor'] })
    expect(editor).toBe(html)
    expect(admin).not.toContain('<script')
  })

  it('bypassRoles=["owner","admin","editor"]：所有角色都跳过', () => {
    const html = '<svg onload="x"/>'
    const bypass: Array<'owner' | 'admin' | 'editor'> = ['owner', 'admin', 'editor']
    for (const role of bypass) {
      expect(sanitizeRichTextHtml(html, { role, bypassRoles: bypass })).toBe(html)
    }
  })
})
