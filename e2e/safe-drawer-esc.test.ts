import { expect, test, type BrowserContext, type Page } from '@playwright/test'
import { setupPerTestApp, type TestAppInstance } from './helpers/app-instance'
import { closePageAndContext } from './helpers/browser'

// 验证 SafeDrawer 的渐进式 ESC：在 TextInput / CodeMirror 中按 ESC 仅失焦，
// 焦点离开输入元素后再按 ESC 才关闭 Drawer，避免编辑过程中误关丢失内容。
test.describe('SafeDrawer ESC 行为', () => {
  let app: TestAppInstance

  test.beforeEach(async ({ browserName: _browserName }, testInfo) => {
    app = await setupPerTestApp(testInfo)
  })

  test.afterEach(async ({ browserName: _browserName }, testInfo) => {
    await app.cleanup({ removeArtifacts: testInfo.status === 'passed' })
  })

  test('输入元素中按 ESC 仅失焦，再按一次才关闭 Drawer', async ({ browser }) => {
    let context: BrowserContext | null = null
    let page: Page | null = null

    try {
      context = await browser.newContext(app.browserContextOptions)
      page = await context.newPage()

      await page.goto(app.adminUrl('/appearance'))

      const newThemeBtn = page.locator('[data-role="appearance-new-theme-button"]')
      await expect(newThemeBtn).toBeVisible()
      await newThemeBtn.click()

      const drawer = page.locator('[data-role="appearance-style-drawer"]')
      await expect(drawer).toBeVisible()

      // 1) 在 TextInput 中按 ESC：drawer 不关，input 失焦
      const nameInput = drawer.locator('input').first()
      await nameInput.click()
      await nameInput.fill('e2e-theme')
      await expect(nameInput).toBeFocused()

      await page.keyboard.press('Escape')
      await expect(drawer).toBeVisible()
      await expect(nameInput).not.toBeFocused()

      // 2) 在 CodeMirror 中按 ESC：drawer 不关，编辑区失焦
      const codeMirror = drawer.locator('.cm-content')
      await codeMirror.click()
      await page.keyboard.type('body { color: red; }')
      await expect(codeMirror).toBeFocused()

      await page.keyboard.press('Escape')
      await expect(drawer).toBeVisible()
      await expect(codeMirror).not.toBeFocused()

      // 3) 焦点已不在输入元素时按 ESC：drawer 正常关闭
      await page.keyboard.press('Escape')
      await expect(drawer).toBeHidden()
    } finally {
      await closePageAndContext(page, context)
    }
  })

  test('焦点在 Drawer 之外（嵌套 Modal 等场景）时按 ESC 不应关闭 Drawer', async ({ browser }) => {
    let context: BrowserContext | null = null
    let page: Page | null = null

    try {
      context = await browser.newContext(app.browserContextOptions)
      page = await context.newPage()

      await page.goto(app.adminUrl('/appearance'))

      const newThemeBtn = page.locator('[data-role="appearance-new-theme-button"]')
      await expect(newThemeBtn).toBeVisible()
      await newThemeBtn.click()

      const drawer = page.locator('[data-role="appearance-style-drawer"]')
      await expect(drawer).toBeVisible()

      // 模拟"嵌套 Modal/Drawer"：在 body 末尾另起一个 portal，把焦点放进去。
      // 真实场景下 Mantine Modal 也是 portal 渲染在 body 末尾，跟 Drawer portal 兄弟，
      // 对 SafeDrawer 而言 activeElement 同样位于 rootRef 之外，行为应一致。
      await page.evaluate(() => {
        const fakePortal = document.createElement('div')
        fakePortal.id = 'e2e-fake-portal'
        const input = document.createElement('input')
        input.id = 'e2e-fake-input'
        fakePortal.appendChild(input)
        document.body.appendChild(fakePortal)
        input.focus()
      })

      const fakeInput = page.locator('#e2e-fake-input')
      await expect(fakeInput).toBeFocused()

      // 按 ESC：SafeDrawer 检测到焦点不在自己内部，不响应；
      // Drawer 应保持打开，且 fakeInput 不应被 blur（否则说明 contains 检查失效）
      await page.keyboard.press('Escape')
      await expect(drawer).toBeVisible()
      await expect(fakeInput).toBeFocused()

      // 移除外部 portal 后焦点切回 Drawer 内，再按 ESC 应该恢复"正常关闭"流程，
      // 验证 contains 检查只过滤"外部焦点"分支，未把主流程一并误伤
      await page.evaluate(() => {
        document.getElementById('e2e-fake-portal')?.remove()
      })
      const codeMirror = drawer.locator('.cm-content')
      await codeMirror.click()
      await expect(codeMirror).toBeFocused()
      await page.keyboard.press('Escape') // 第一次：CodeMirror 失焦但 Drawer 不关
      await expect(codeMirror).not.toBeFocused()
      await expect(drawer).toBeVisible()
      await page.keyboard.press('Escape') // 第二次：关闭 Drawer
      await expect(drawer).toBeHidden()
    } finally {
      await closePageAndContext(page, context)
    }
  })
})
