import { expect, test, type BrowserContext, type Page } from '@playwright/test'
import { createPostRecord, type CreatedPost } from './helpers/content'
import { setupPerFileApp, type TestAppInstance } from './helpers/app-instance'
import { expectRichText, expectRichTextEmpty, pushClientRoute } from './helpers/editor'

test.describe('文章编辑器路由切换', () => {
  test.describe.configure({ mode: 'serial' })

  let app: TestAppInstance | null = null
  let context: BrowserContext | null = null
  let page: Page | null = null
  let postA: CreatedPost
  let postB: CreatedPost

  test.beforeAll(async ({ browserName: _browserName }, testInfo) => {
    app = await setupPerFileApp(testInfo, { label: 'post-editor-shared' })
    postA = await createPostRecord(app.request, {
      title: 'E2E 文章 A',
      slug: 'e2e-post-a',
      bodyText: '这是文章A正文',
    })
    postB = await createPostRecord(app.request, {
      title: 'E2E 文章 B',
      slug: 'e2e-post-b',
      bodyText: '这是文章B正文',
    })
  })

  test.afterAll(async () => {
    await app?.cleanup()
  })

  test.beforeEach(async ({ browser }) => {
    context = await browser.newContext(app!.browserContextOptions)
    page = await context.newPage()
  })

  test.afterEach(async () => {
    await page?.close()
    await context?.close()
    page = null
    context = null
  })

  test('从编辑页切回新建页会重置状态', async () => {
    const currentPage = page!

    await currentPage.goto(app!.adminUrl(`/posts/${postA.id}`))
    await expect(currentPage.getByRole('textbox', { name: '标题', exact: true })).toHaveValue(
      postA.title,
    )
    await expect(currentPage.getByRole('textbox', { name: 'Slug', exact: true })).toHaveValue(
      postA.slug,
    )
    await expectRichText(currentPage, '这是文章A正文')

    await pushClientRoute(currentPage, app!.adminUrl('/posts/new'))
    await expect(currentPage).toHaveURL(app!.adminUrl('/posts/new'))
    await expect(currentPage.getByRole('heading', { name: '新建文章' })).toBeVisible()
    await expect(currentPage.getByRole('textbox', { name: '标题', exact: true })).toHaveValue('')
    await expect(currentPage.getByRole('textbox', { name: 'Slug', exact: true })).toHaveValue('')
    await expectRichTextEmpty(currentPage)
    await expect(currentPage.getByText('查看历史版本')).toHaveCount(0)
  })

  test('从文章 A 切到文章 B 不会残留旧内容', async () => {
    const currentPage = page!

    await currentPage.goto(app!.adminUrl(`/posts/${postA.id}`))
    await expect(currentPage.getByRole('textbox', { name: '标题', exact: true })).toHaveValue(
      postA.title,
    )
    await expectRichText(currentPage, '这是文章A正文')

    await pushClientRoute(currentPage, app!.adminUrl(`/posts/${postB.id}`))
    await expect(currentPage).toHaveURL(app!.adminUrl(`/posts/${postB.id}`))
    await expect(currentPage.getByRole('textbox', { name: '标题', exact: true })).toHaveValue(
      postB.title,
    )
    await expect(currentPage.getByRole('textbox', { name: 'Slug', exact: true })).toHaveValue(
      postB.slug,
    )
    await expectRichText(currentPage, '这是文章B正文')
  })
})
