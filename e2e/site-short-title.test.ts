import { expect, test, type BrowserContext, type Page } from '@playwright/test'
import { adminLogin } from './helpers/admin'
import { setupPerFileApp, type TestAppInstance } from './helpers/app-instance'
import { closePageAndContext } from './helpers/browser'

/** 侧边栏站点简称元素 */
function siteTitle(page: Page) {
  return page.locator('[data-role="admin-site-title"]')
}

/** 编辑站点简称弹窗（Mantine Modal 通过 Portal 渲染，需要用 role=dialog 定位） */
function siteTitleModal(page: Page) {
  const dialog = page.getByRole('dialog')
  return {
    root: dialog,
    input: dialog.locator('[data-role="admin-site-title-input"]'),
    saveButton: dialog.locator('[data-role="admin-site-title-save"]'),
  }
}

test.describe('站点简称', () => {
  test.describe.configure({ mode: 'serial' })

  let app: TestAppInstance | null = null

  test.beforeAll(async ({ browserName: _browserName }, testInfo) => {
    app = await setupPerFileApp(testInfo, { label: 'site-short-title' })
  })

  test.afterAll(async ({ browserName: _browserName }, testInfo) => {
    await app?.cleanup({ removeArtifacts: testInfo.status === 'passed' })
  })

  test('侧边栏默认显示 Publa', async ({ browser }) => {
    let context: BrowserContext | null = null
    let page: Page | null = null

    try {
      context = await browser.newContext(app!.browserContextOptions)
      page = await context.newPage()

      await page.goto(app!.adminUrl())
      const title = siteTitle(page)
      await expect(title).toBeVisible()
      await expect(title).toHaveText(/Publa/)
    } finally {
      await closePageAndContext(page, context)
    }
  })

  test('点击站点简称弹出编辑对话框', async ({ browser }) => {
    let context: BrowserContext | null = null
    let page: Page | null = null

    try {
      context = await browser.newContext(app!.browserContextOptions)
      page = await context.newPage()

      await page.goto(app!.adminUrl())
      await siteTitle(page).click()

      const modal = siteTitleModal(page)
      await expect(modal.root).toBeVisible()
      await expect(modal.input).toBeVisible()
      await expect(modal.saveButton).toBeVisible()
    } finally {
      await closePageAndContext(page, context)
    }
  })

  test('编辑并保存站点简称', async ({ browser }) => {
    let context: BrowserContext | null = null
    let page: Page | null = null

    try {
      context = await browser.newContext(app!.browserContextOptions)
      page = await context.newPage()

      await page.goto(app!.adminUrl())

      // 打开编辑弹窗
      await siteTitle(page).click()
      const modal = siteTitleModal(page)
      await expect(modal.root).toBeVisible()

      // 输入新名称并保存
      await modal.input.fill('测试博客')
      await modal.saveButton.click()

      // 弹窗关闭，侧边栏立即更新
      await expect(modal.root).not.toBeVisible()
      await expect(siteTitle(page)).toHaveText(/测试博客/)
    } finally {
      await closePageAndContext(page, context)
    }
  })

  test('刷新页面后站点简称保持', async ({ browser }) => {
    let context: BrowserContext | null = null
    let page: Page | null = null

    try {
      context = await browser.newContext(app!.browserContextOptions)
      page = await context.newPage()

      await page.goto(app!.adminUrl())
      await expect(siteTitle(page)).toHaveText(/测试博客/)
    } finally {
      await closePageAndContext(page, context)
    }
  })

  test('登录页显示自定义站点简称', async ({ browser }) => {
    let context: BrowserContext | null = null
    let page: Page | null = null

    try {
      // 使用无登录态的上下文访问登录页
      context = await browser.newContext({ baseURL: app!.baseURL })
      page = await context.newPage()

      await page.goto(app!.adminUrl('/login'))
      const loginPage = adminLogin(page)
      await expect(loginPage.form).toBeVisible()

      // 页面标题包含自定义站点简称
      const pageTitle = page.locator('h1')
      await expect(pageTitle).toContainText('测试博客')
    } finally {
      await closePageAndContext(page, context)
    }
  })

  test('清空站点简称后恢复默认值 Publa', async ({ browser }) => {
    let context: BrowserContext | null = null
    let page: Page | null = null

    try {
      context = await browser.newContext(app!.browserContextOptions)
      page = await context.newPage()

      await page.goto(app!.adminUrl())

      // 打开编辑弹窗
      await siteTitle(page).click()
      const modal = siteTitleModal(page)
      await expect(modal.root).toBeVisible()

      // 清空并保存
      await modal.input.clear()
      await modal.saveButton.click()

      // 恢复为默认值
      await expect(modal.root).not.toBeVisible()
      await expect(siteTitle(page)).toHaveText(/Publa/)
    } finally {
      await closePageAndContext(page, context)
    }
  })

  test('站点简称不超过 30 字符', async ({ browser }) => {
    let context: BrowserContext | null = null
    let page: Page | null = null

    try {
      context = await browser.newContext(app!.browserContextOptions)
      page = await context.newPage()

      await page.goto(app!.adminUrl())

      // 打开编辑弹窗
      await siteTitle(page).click()
      const modal = siteTitleModal(page)
      await expect(modal.root).toBeVisible()

      // 输入超长文本（40 个字符）
      const longText = 'A'.repeat(40)
      await modal.input.fill(longText)

      // 输入被截断为 30 字符
      await expect(modal.input).toHaveValue('A'.repeat(30))
    } finally {
      await closePageAndContext(page, context)
    }
  })
})
