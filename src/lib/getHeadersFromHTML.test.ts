import { describe, expect, it } from 'vitest'
import getHeadersFromHTML from './getHeadersFromHTML'

describe('getHeadersFromHTML', () => {
  // ── 基本行为 ──

  it('无标题时返回空数组', () => {
    const { headers } = getHeadersFromHTML('<p>普通段落</p>')
    expect(headers).toEqual([])
  })

  it('空字符串返回空数组', () => {
    const { headers } = getHeadersFromHTML('')
    expect(headers).toEqual([])
  })

  // ── 单行 HTML（回归测试） ──

  it('单行 HTML 中能正确提取多个标题', () => {
    const html =
      '<p>intro</p><h2>准备工作</h2><p>内容</p><h2>GitHub</h2><p>内容</p><h2>Turso</h2>'
    const { headers } = getHeadersFromHTML(html)
    expect(headers).toHaveLength(3)
    expect(headers.map((h) => h.title)).toEqual(['准备工作', 'GitHub', 'Turso'])
  })

  it('单行 HTML 中混合不同级别标题', () => {
    const html = '<h2>章节</h2><p>文本</p><h3>子章节</h3><p>文本</p><h2>下一章</h2>'
    const { headers } = getHeadersFromHTML(html)
    expect(headers).toHaveLength(3)
    expect(headers.map((h) => h.title)).toEqual(['章节', '子章节', '下一章'])
  })

  // ── 多行 HTML ──

  it('多行 HTML 同样正确提取', () => {
    const html = ['<h2>第一节</h2>', '<p>段落</p>', '<h2>第二节</h2>'].join('\n')
    const { headers } = getHeadersFromHTML(html)
    expect(headers).toHaveLength(2)
    expect(headers.map((h) => h.title)).toEqual(['第一节', '第二节'])
  })

  // ── 层级编号 ──

  it('同级标题递增编号', () => {
    const html = '<h2>A</h2><h2>B</h2><h2>C</h2>'
    const { headers } = getHeadersFromHTML(html)
    expect(headers.map((h) => h.number)).toEqual(['1', '2', '3'])
  })

  it('子级标题生成嵌套编号', () => {
    const html = '<h2>父</h2><h3>子1</h3><h3>子2</h3>'
    const { headers } = getHeadersFromHTML(html)
    expect(headers.map((h) => h.number)).toEqual(['1', '1.1', '1.2'])
  })

  it('从子级回到父级时编号正确递增', () => {
    const html = '<h2>A</h2><h3>A-1</h3><h2>B</h2>'
    const { headers } = getHeadersFromHTML(html)
    expect(headers.map((h) => h.number)).toEqual(['1', '1.1', '2'])
  })

  // ── 标题内嵌套 HTML ──

  it('标题内包含内联标签时正确提取纯文本', () => {
    const html = '<h2><strong>加粗</strong>标题</h2>'
    const { headers } = getHeadersFromHTML(html)
    expect(headers[0].title).toBe('加粗标题')
  })

  it('标题内包含链接时正确提取纯文本', () => {
    const html = '<h2><a href="/link">链接标题</a></h2>'
    const { headers } = getHeadersFromHTML(html)
    expect(headers[0].title).toBe('链接标题')
  })

  it('标题内包含 code 标签时正确提取纯文本', () => {
    const html = '<h2>使用 <code>npm install</code> 安装</h2>'
    const { headers } = getHeadersFromHTML(html)
    expect(headers[0].title).toBe('使用 npm install 安装')
  })

  // ── 标题前缀数字剥离 ──

  it('剥离标题开头的序号', () => {
    const html = '<h2>1. 第一步</h2><h2>2. 第二步</h2>'
    const { headers } = getHeadersFromHTML(html)
    expect(headers.map((h) => h.title)).toEqual(['第一步', '第二步'])
  })

  // ── HTML 输出 ──

  it('输出 HTML 中标题带有 data-toc-id 和锚点', () => {
    const { html } = getHeadersFromHTML('<h2>标题</h2>')
    expect(html).toContain('data-toc-id="1"')
    expect(html).toContain('<a id="1-标题"></a>')
  })

  it('已有 data-toc-id 时会被替换', () => {
    const { html } = getHeadersFromHTML('<h2 data-toc-id="old">标题</h2>')
    expect(html).toContain('data-toc-id="1"')
    expect(html).not.toContain('data-toc-id="old"')
  })

  // ── 带属性的标题标签 ──

  it('带 class 等属性的标题标签正确解析', () => {
    const html = '<h2 class="title" id="my-title">带属性</h2>'
    const { headers } = getHeadersFromHTML(html)
    expect(headers[0].title).toBe('带属性')
  })
})
