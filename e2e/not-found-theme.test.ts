import { expect, test } from '@playwright/test'
import { setupPerTestApp, type TestAppInstance } from './helpers/app-instance'

test.describe('404 页面主题链接', () => {
  let app: TestAppInstance

  test.beforeEach(async ({ browserName: _browserName }, testInfo) => {
    app = await setupPerTestApp(testInfo)
  })

  test.afterEach(async ({ browserName: _browserName }, testInfo) => {
    await app.cleanup({ removeArtifacts: testInfo.status === 'passed' })
  })

  test('访问不存在的路径时 HTML 中包含主题 CSS 链接', async () => {
    const res = await fetch(`${app.baseURL}/this-path-definitely-does-not-exist-42`, {
      headers: { Accept: 'text/html' },
    })

    expect(res.status).toBe(404)
    const html = await res.text()

    // 404 页面走 BlankLayout，应当注入当前主题的 CSS link。
    // seed 阶段已把 activeThemeId 指向内置 light 主题，前台直接指向 /public/themes/light.css。
    expect(html).toMatch(/\/themes\/light\.css/)
    // 同时确认 404 文案本身已渲染
    expect(html).toContain('404 - 页面没有找到')
  })
})
