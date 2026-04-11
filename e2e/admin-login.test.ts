import { expect, test, type BrowserContext, type Page } from '@playwright/test'
import { setupPerTestApp, type TestAppInstance } from './helpers/app-instance'
import { adminLogin, adminShell } from './helpers/admin'
import { closePageAndContext } from './helpers/browser'

test.describe('后台登录', () => {
  let app: TestAppInstance

  test.beforeEach(async ({ browserName: _browserName }, testInfo) => {
    app = await setupPerTestApp(testInfo)
  })

  test.afterEach(async ({ browserName: _browserName }, testInfo) => {
    await app.cleanup({ removeArtifacts: testInfo.status === 'passed' })
  })

  test('登录页可以登录到后台首页', async ({ browser }) => {
    let context: BrowserContext | null = null
    let page: Page | null = null

    try {
      context = await browser.newContext({ baseURL: app.baseURL })
      page = await context.newPage()
      const loginPage = adminLogin(page)
      const shell = adminShell(page)

      await page.goto(app.adminUrl('/login'))
      await expect(loginPage.form).toBeVisible()
      await loginPage.usernameInput.fill(app.credentials.username)
      await loginPage.passwordInput.fill(app.credentials.password)
      await loginPage.submitButton.click()

      await expect(page).toHaveURL(app.adminUrl())
      await expect(shell.dashboardPage).toBeVisible()
      await expect(shell.dashboardTitle).toBeVisible()
      await expect(shell.navLink('posts')).toBeVisible()
    } finally {
      await closePageAndContext(page, context)
    }
  })
})
