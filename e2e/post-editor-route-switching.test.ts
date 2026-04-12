import { expect, test, type BrowserContext, type Page } from '@playwright/test'
import { createPostRecord, type CreatedPost } from './helpers/content'
import { setupPerFileApp, type TestAppInstance } from './helpers/app-instance'
import { postEditor } from './helpers/admin'
import { closePageAndContext } from './helpers/browser'
import { expectRichText, expectRichTextEmpty, pushClientRoute } from './helpers/editor'

test.describe('文章编辑器路由切换', () => {
  test.describe.configure({ mode: 'serial' })

  let app: TestAppInstance | null = null
  let context: BrowserContext | null = null
  let page: Page | null = null
  let hasFailed = false
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

  test('从编辑页切回新建页会重置状态', async () => {
    const currentPage = page!
    const editor = postEditor(currentPage)

    await currentPage.goto(app!.adminUrl(`/posts/${postA.id}`))
    await expect(editor.titleInput).toHaveValue(postA.title)
    await expect(editor.slugInput).toHaveValue(postA.slug)
    await expectRichText(currentPage, '这是文章A正文')

    await pushClientRoute(currentPage, app!.adminUrl('/posts/new'))
    await expect(currentPage).toHaveURL(app!.adminUrl('/posts/new'))
    await expect(editor.pageTitle).toBeVisible()
    await expect(editor.titleInput).toHaveValue('')
    await expect(editor.slugInput).toHaveValue('')
    await expectRichTextEmpty(currentPage)
    await expect(editor.historyButton).toHaveCount(0)
  })

  test('从文章 A 切到文章 B 不会残留旧内容', async () => {
    const currentPage = page!
    const editor = postEditor(currentPage)

    await currentPage.goto(app!.adminUrl(`/posts/${postA.id}`))
    await expect(editor.titleInput).toHaveValue(postA.title)
    await expectRichText(currentPage, '这是文章A正文')

    await pushClientRoute(currentPage, app!.adminUrl(`/posts/${postB.id}`))
    await expect(currentPage).toHaveURL(app!.adminUrl(`/posts/${postB.id}`))
    await expect(editor.titleInput).toHaveValue(postB.title)
    await expect(editor.slugInput).toHaveValue(postB.slug)
    await expectRichText(currentPage, '这是文章B正文')
  })
})
