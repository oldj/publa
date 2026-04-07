import { describe, expect, it } from 'vitest'
import { parseHeadHtml } from './parse-head-html'

describe('parseHeadHtml', () => {
  // ── 基本行为 ──

  it('空字符串返回空数组', () => {
    expect(parseHeadHtml('')).toEqual([])
    expect(parseHeadHtml('  ')).toEqual([])
  })

  // ── <meta> 标签 ──

  it('解析自闭合 <meta> 标签', () => {
    const result = parseHeadHtml('<meta name="description" content="hello" />')
    expect(result).toHaveLength(1)
    expect(result[0]).toEqual({
      tag: 'meta',
      attrs: { name: 'description', content: 'hello' },
    })
  })

  it('解析无斜杠闭合的 <meta> 标签', () => {
    const result = parseHeadHtml('<meta charset="utf-8">')
    expect(result).toHaveLength(1)
    expect(result[0].tag).toBe('meta')
    expect(result[0].attrs).toEqual({ charSet: 'utf-8' })
  })

  it('将 http-equiv 映射为 httpEquiv', () => {
    const result = parseHeadHtml('<meta http-equiv="X-UA-Compatible" content="IE=edge">')
    expect(result[0].attrs).toEqual({ httpEquiv: 'X-UA-Compatible', content: 'IE=edge' })
  })

  // ── <link> 标签 ──

  it('解析 <link> 标签', () => {
    const result = parseHeadHtml('<link rel="stylesheet" href="/style.css" />')
    expect(result).toHaveLength(1)
    expect(result[0]).toEqual({
      tag: 'link',
      attrs: { rel: 'stylesheet', href: '/style.css' },
    })
  })

  // ── <script> 标签 ──

  it('解析带 src 的外部 <script>', () => {
    const result = parseHeadHtml('<script src="https://example.com/a.js"></script>')
    expect(result).toHaveLength(1)
    expect(result[0].tag).toBe('script')
    expect(result[0].attrs).toEqual({ src: 'https://example.com/a.js' })
    expect(result[0].content).toBe('')
  })

  it('解析带 async/defer 布尔属性的 <script>', () => {
    const result = parseHeadHtml('<script async defer src="/a.js"></script>')
    expect(result[0].attrs).toEqual({ async: true, defer: true, src: '/a.js' })
  })

  it('解析内联 <script>', () => {
    const js = 'console.log("hello")'
    const result = parseHeadHtml(`<script>${js}</script>`)
    expect(result).toHaveLength(1)
    expect(result[0].tag).toBe('script')
    expect(result[0].content).toBe(js)
  })

  it('解析带类型的内联 <script>', () => {
    const json = '{"@context":"https://schema.org"}'
    const result = parseHeadHtml(`<script type="application/ld+json">${json}</script>`)
    expect(result[0].attrs).toEqual({ type: 'application/ld+json' })
    expect(result[0].content).toBe(json)
  })

  // ── <style> 标签 ──

  it('解析内联 <style>', () => {
    const css = 'body { margin: 0; }'
    const result = parseHeadHtml(`<style>${css}</style>`)
    expect(result).toHaveLength(1)
    expect(result[0]).toEqual({
      tag: 'style',
      attrs: {},
      content: css,
    })
  })

  it('解析带属性的 <style>', () => {
    const result = parseHeadHtml('<style type="text/css">a{color:red}</style>')
    expect(result[0].attrs).toEqual({ type: 'text/css' })
    expect(result[0].content).toBe('a{color:red}')
  })

  // ── 不支持的标签 ──

  it('忽略 <div> 标签', () => {
    const result = parseHeadHtml('<div>hello</div>')
    expect(result).toEqual([])
  })

  it('忽略 <p>、<span>、<img> 等标签', () => {
    const result = parseHeadHtml('<p>text</p><span>x</span><img src="a.png" />')
    expect(result).toEqual([])
  })

  it('忽略纯文本内容', () => {
    const result = parseHeadHtml('just some text')
    expect(result).toEqual([])
  })

  // ── 混合内容 ──

  it('从混合内容中只提取支持的标签', () => {
    const html = `
      <meta name="viewport" content="width=device-width" />
      <div>不支持的标签</div>
      <script src="/analytics.js"></script>
      <p>这也会被忽略</p>
      <link rel="icon" href="/favicon.ico" />
      <style>body{font-size:16px}</style>
    `
    const result = parseHeadHtml(html)
    expect(result).toHaveLength(4)

    const tags = result.map((el) => el.tag)
    expect(tags).toContain('meta')
    expect(tags).toContain('script')
    expect(tags).toContain('link')
    expect(tags).toContain('style')
  })

  it('解析多个同类型标签', () => {
    const html = `
      <meta name="a" content="1" />
      <meta name="b" content="2" />
    `
    const result = parseHeadHtml(html)
    expect(result).toHaveLength(2)
    expect(result[0].attrs).toEqual({ name: 'a', content: '1' })
    expect(result[1].attrs).toEqual({ name: 'b', content: '2' })
  })

  // ── 属性映射 ──

  it('将 crossorigin 映射为 crossOrigin', () => {
    const result = parseHeadHtml('<script crossorigin="anonymous" src="/a.js"></script>')
    expect(result[0].attrs.crossOrigin).toBe('anonymous')
  })

  it('将 class 映射为 className', () => {
    const result = parseHeadHtml('<style class="custom">a{}</style>')
    expect(result[0].attrs.className).toBe('custom')
  })

  // ── 边界情况 ──

  it('处理单引号属性值', () => {
    const result = parseHeadHtml("<meta name='test' content='value' />")
    expect(result[0].attrs).toEqual({ name: 'test', content: 'value' })
  })

  it('处理多行 <script> 内联代码', () => {
    const js = `
      var a = 1;
      console.log(a);
    `
    const result = parseHeadHtml(`<script>${js}</script>`)
    expect(result[0].content).toBe(js)
  })
})
