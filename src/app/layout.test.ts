import fs from 'node:fs'
import path from 'node:path'
import { describe, expect, it } from 'vitest'

/**
 * 架构约束：自定义 HTML 只应出现在前台（BasicLayout），不应出现在根布局中。
 * 根布局影响所有页面（包括后台），如果在此注入自定义 HTML 会影响管理后台。
 */
describe('根布局不注入自定义 HTML', () => {
  const layoutSource = fs.readFileSync(path.resolve(__dirname, 'layout.tsx'), 'utf-8')

  it('不引用 customHeadHtml', () => {
    expect(layoutSource).not.toContain('customHeadHtml')
  })

  it('不引用 customBodyStartHtml', () => {
    expect(layoutSource).not.toContain('customBodyStartHtml')
  })

  it('不引用 customBodyEndHtml', () => {
    expect(layoutSource).not.toContain('customBodyEndHtml')
  })

  it('不使用 HeadElements 组件', () => {
    expect(layoutSource).not.toContain('HeadElements')
  })

  it('不使用 dangerouslySetInnerHTML', () => {
    expect(layoutSource).not.toContain('dangerouslySetInnerHTML')
  })
})
