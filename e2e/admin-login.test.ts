import { expect, test, type BrowserContext, type Page } from '@playwright/test'
import { setupPerTestApp, type TestAppInstance } from './helpers/app-instance'

test.describe('后台登录', () => {
  let app: TestAppInstance

  test.beforeEach(async ({ browserName: _browserName }, testInfo) => {
    app = await setupPerTestApp(testInfo)
  })

  test.afterEach(async () => {
    await app.cleanup()
  })

  test('登录页可以登录到后台首页', async ({ browser }) => {
    let context: BrowserContext | null = null
    let page: Page | null = null

    try {
      context = await browser.newContext({ baseURL: app.baseURL })
      page = await context.newPage()

      await page.goto(app.adminUrl('/login'))
      await page.getByLabel('用户名').fill(app.credentials.username)
      await page.getByLabel('密码').fill(app.credentials.password)
      await page.getByRole('button', { name: '登录' }).click()

      await expect(page).toHaveURL(app.adminUrl())
      await expect(page.getByRole('heading', { name: '仪表盘' })).toBeVisible()
      await expect(page.getByRole('link', { name: '文章' })).toBeVisible()
    } finally {
      await page?.close()
      await context?.close()
    }
  })
})
