import { expect, test, type BrowserContext, type Page } from '@playwright/test'
import { setupPerFileApp, type TestAppInstance } from './helpers/app-instance'
import { adminPagesPage, adminPostsPage, pageEditor, postEditor } from './helpers/admin'
import { closePageAndContext } from './helpers/browser'
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
    await closePageAndContext(page, context)
    page = null
    context = null
  })

  test('文章管理页的真实入口可以进入编辑页和新建页', async () => {
    const currentPage = page!
    const postsPage = adminPostsPage(currentPage)
    const editor = postEditor(currentPage)

    await currentPage.goto(app!.adminUrl('/posts'))
    await expect(postsPage.title).toBeVisible()

    await currentPage.getByRole('link', { name: post.title, exact: true }).click()
    await expect(currentPage).toHaveURL(app!.adminUrl(`/posts/${post.id}`))
    await expect(editor.titleInput).toHaveValue(post.title)

    await editor.backButton.click()
    await expect(currentPage).toHaveURL(app!.adminUrl('/posts'))
    await expect(postsPage.title).toBeVisible()

    await postsPage.newButton.click()
    await expect(currentPage).toHaveURL(app!.adminUrl('/posts/new'))
    await expect(editor.pageTitle).toBeVisible()
  })

  test('页面管理页的真实入口可以进入编辑页和新建页', async () => {
    const currentPage = page!
    const pagesPage = adminPagesPage(currentPage)
    const editor = pageEditor(currentPage)

    await currentPage.goto(app!.adminUrl('/pages'))
    await expect(pagesPage.title).toBeVisible()

    await currentPage.getByRole('link', { name: adminPage.title, exact: true }).click()
    await expect(currentPage).toHaveURL(app!.adminUrl(`/pages/${adminPage.id}`))
    await expect(editor.titleInput).toHaveValue(adminPage.title)

    await editor.backButton.click()
    await expect(currentPage).toHaveURL(app!.adminUrl('/pages'))
    await expect(pagesPage.title).toBeVisible()

    await pagesPage.newButton.click()
    await expect(currentPage).toHaveURL(app!.adminUrl('/pages/new'))
    await expect(editor.pageTitle).toBeVisible()
  })
})
