import fs from 'node:fs'
import path from 'node:path'
import { describe, expect, it } from 'vitest'

/**
 * 架构约束：
 * - customHeadHtml 在根布局中条件渲染（仅前台页面），通过 isFrontend 守卫控制
 * - customBodyStartHtml / customBodyEndHtml 只应出现在前台 BasicLayout 中
 */
describe('根布局自定义 HTML 约束', () => {
  const layoutSource = fs.readFileSync(path.resolve(__dirname, 'layout.tsx'), 'utf-8')

  it('不引用 customBodyStartHtml', () => {
    expect(layoutSource).not.toContain('customBodyStartHtml')
  })

  it('不引用 customBodyEndHtml', () => {
    expect(layoutSource).not.toContain('customBodyEndHtml')
  })

  it('不使用 dangerouslySetInnerHTML', () => {
    expect(layoutSource).not.toContain('dangerouslySetInnerHTML')
  })

  it('HeadElements 渲染在 <head> 标签内部', () => {
    const headStart = layoutSource.indexOf('<head>')
    const headEnd = layoutSource.indexOf('</head>')
    const headElementsPos = layoutSource.indexOf('<HeadElements')

    expect(headStart).toBeGreaterThan(-1)
    expect(headEnd).toBeGreaterThan(-1)
    expect(headElementsPos).toBeGreaterThan(headStart)
    expect(headElementsPos).toBeLessThan(headEnd)
  })

  it('customHeadHtml 受 isFrontend 条件守卫保护', () => {
    // 确保三者在同一表达式中，而非散落在不同位置
    expect(layoutSource).toContain('isFrontend && customHeadHtml && <HeadElements')
  })
})
