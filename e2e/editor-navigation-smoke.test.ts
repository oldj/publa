import { expect, test, type BrowserContext, type Page } from '@playwright/test'
import { setupPerFileApp, type TestAppInstance } from './helpers/app-instance'
import {
  createPageRecord,
  createPostRecord,
  type CreatedPage,
  type CreatedPost,
} from './helpers/content'

test.describe('编辑器真实导航入口', () => {
  test.describe.configure({ mode: 'serial' })

  let app: TestAppInstance | null = null
  let context: BrowserContext | null = null
  let page: Page | null = null
  let hasFailed = false
  let post: CreatedPost
  let adminPage: CreatedPage

  test.beforeAll(async ({ browserName: _browserName }, testInfo) => {
    app = await setupPerFileApp(testInfo, { label: 'editor-navigation-shared' })
    post = await createPostRecord(app.request, {
      title: 'E2E 导航文章',
      slug: 'e2e-nav-post',
      bodyText: '这是导航文章正文',
    })
    adminPage = await createPageRecord(app.request, {
      title: 'E2E 导航页面',
      path: 'e2e-nav-page',
      bodyText: '这是导航页面正文',
    })
  })

  test.afterAll(async () => {
    await app?.cleanup({ removeArtifacts: !hasFailed })
  })

  test.beforeEach(async ({ browser }) => {
    context = await browser.newContext(app!.browserContextOptions)
    page = await context.newPage()
  })

  test.afterEach(async ({ browserName: _browserName }, testInfo) => {
    if (testInfo.status !== 'passed') hasFailed = true
    await page?.close()
    await context?.close()
    page = null
    context = null
  })

  test('文章管理页的真实入口可以进入编辑页和新建页', async () => {
    const currentPage = page!

    await currentPage.goto(app!.adminUrl('/posts'))
    await expect(currentPage.getByRole('heading', { name: '文章管理' })).toBeVisible()

    await currentPage.getByRole('link', { name: post.title, exact: true }).click()
    await expect(currentPage).toHaveURL(app!.adminUrl(`/posts/${post.id}`))
    await expect(currentPage.getByRole('textbox', { name: '标题', exact: true })).toHaveValue(
      post.title,
    )

    await currentPage.getByRole('link', { name: '返回' }).click()
    await expect(currentPage).toHaveURL(app!.adminUrl('/posts'))
    await expect(currentPage.getByRole('heading', { name: '文章管理' })).toBeVisible()

    await currentPage.getByRole('link', { name: '新建文章' }).click()
    await expect(currentPage).toHaveURL(app!.adminUrl('/posts/new'))
    await expect(currentPage.getByRole('heading', { name: '新建文章' })).toBeVisible()
  })

  test('页面管理页的真实入口可以进入编辑页和新建页', async () => {
    const currentPage = page!

    await currentPage.goto(app!.adminUrl('/pages'))
    await expect(currentPage.getByRole('heading', { name: '页面管理' })).toBeVisible()

    await currentPage.getByRole('link', { name: adminPage.title, exact: true }).click()
    await expect(currentPage).toHaveURL(app!.adminUrl(`/pages/${adminPage.id}`))
    await expect(currentPage.getByRole('textbox', { name: '标题', exact: true })).toHaveValue(
      adminPage.title,
    )

    await currentPage.getByRole('link', { name: '返回' }).click()
    await expect(currentPage).toHaveURL(app!.adminUrl('/pages'))
    await expect(currentPage.getByRole('heading', { name: '页面管理' })).toBeVisible()

    await currentPage.getByRole('link', { name: '新建页面' }).click()
    await expect(currentPage).toHaveURL(app!.adminUrl('/pages/new'))
    await expect(currentPage.getByRole('heading', { name: '新建页面' })).toBeVisible()
  })
})
