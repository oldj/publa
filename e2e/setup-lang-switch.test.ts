import { expect, test, type BrowserContext, type Page } from '@playwright/test'
import { setupPerTestApp, type TestAppInstance } from './helpers/app-instance'
import { closePageAndContext } from './helpers/browser'

test.describe('Setup 页面语言切换', () => {
  let app: TestAppInstance

  test.beforeEach(async ({ browserName: _browserName }, testInfo) => {
    app = await setupPerTestApp(testInfo, { skipInit: true })
  })

  test.afterEach(async ({ browserName: _browserName }, testInfo) => {
    await app.cleanup({ removeArtifacts: testInfo.status === 'passed' })
  })

  test('切换语言后界面文案立即刷新，且表单输入不丢失', async ({ browser }) => {
    let context: BrowserContext | null = null
    let page: Page | null = null

    try {
      context = await browser.newContext({ baseURL: app.baseURL })
      page = await context.newPage()

      await page.goto('/setup')

      // 默认 locale 为 en（无 Accept-Language 时降级到 DEFAULT_LOCALE）
      await expect(page.getByRole('heading', { name: 'Publa Setup' })).toBeVisible()
      await expect(page.getByRole('button', { name: 'Submit' })).toBeVisible()

      // 在输入框中填写一些内容，用于验证切换语言后不丢失
      await page.getByLabel(/username/i).fill('testuser')

      // 切换到中文：点击 Mantine Select combobox 打开下拉，选择"简体中文"
      await page.getByRole('combobox', { name: 'Interface language' }).click()
      await page.getByRole('option', { name: '简体中文' }).click()

      // 等待页面文案更新为中文
      await expect(page.getByRole('heading', { name: 'Publa 初始化' })).toBeVisible()
      await expect(page.getByRole('button', { name: '提交' })).toBeVisible()

      // 验证已输入的内容未丢失
      await expect(page.getByLabel(/用户名/)).toHaveValue('testuser')

      // 切换回英文
      await page.getByRole('combobox', { name: '界面语言' }).click()
      await page.getByRole('option', { name: 'English' }).click()

      // 验证英文文案恢复
      await expect(page.getByRole('heading', { name: 'Publa Setup' })).toBeVisible()
      await expect(page.getByRole('button', { name: 'Submit' })).toBeVisible()

      // 验证输入内容仍保留
      await expect(page.getByLabel(/username/i)).toHaveValue('testuser')
    } finally {
      await closePageAndContext(page, context)
    }
  })
})
