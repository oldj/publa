import { expect, test, type BrowserContext, type Page } from '@playwright/test'
import { setupPerTestApp, type TestAppInstance } from './helpers/app-instance'
import { expectRichText, richTextEditor } from './helpers/editor'

test.describe('页面编辑器自动保存焦点', () => {
  let app: TestAppInstance

  test.beforeEach(async ({ browserName: _browserName }, testInfo) => {
    app = await setupPerTestApp(testInfo)
  })

  test.afterEach(async ({ browserName: _browserName }, testInfo) => {
    await app.cleanup({ removeArtifacts: testInfo.status === 'passed' })
  })

  test('首次自动保存后页面富文本编辑器不会丢失焦点', async ({ browser }) => {
    let context: BrowserContext | null = null
    let page: Page | null = null

    try {
      context = await browser.newContext(app.browserContextOptions)
      page = await context.newPage()

      await page.goto(app.adminUrl('/pages/new'))
      await page.getByRole('textbox', { name: '标题', exact: true }).fill('E2E 页面标题')
      await page.getByRole('textbox', { name: '路径', exact: true }).fill('e2e-focus-page')

      const editor = richTextEditor(page)
      await expect(editor).toBeVisible()
      await editor.click()
      await page.keyboard.type('页面自动保存前的第一段内容')

      await page.waitForURL(
        new RegExp(`${app.adminUrl('/pages/').replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\d+$`),
        {
          timeout: 20_000,
        },
      )
      await expect(page.locator('[data-role="editor-autosave-time"]')).toBeVisible()
      await expect(editor).toBeFocused()

      await page.keyboard.type(' 页面自动保存后的第二段内容')
      await expectRichText(page, '页面自动保存前的第一段内容 页面自动保存后的第二段内容')
    } finally {
      await page?.close()
      await context?.close()
    }
  })
})
