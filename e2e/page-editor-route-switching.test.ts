import { expect, test, type BrowserContext, type Page } from '@playwright/test'
import { createPageRecord, type CreatedPage } from './helpers/content'
import { setupPerFileApp, type TestAppInstance } from './helpers/app-instance'
import { expectRichText, expectRichTextEmpty, pushClientRoute } from './helpers/editor'

test.describe('页面编辑器路由切换', () => {
  test.describe.configure({ mode: 'serial' })

  let app: TestAppInstance | null = null
  let context: BrowserContext | null = null
  let page: Page | null = null
  let hasFailed = false
  let pageA: CreatedPage
  let pageB: CreatedPage

  test.beforeAll(async ({ browserName: _browserName }, testInfo) => {
    app = await setupPerFileApp(testInfo, { label: 'page-editor-shared' })
    pageA = await createPageRecord(app.request, {
      title: 'E2E 页面 A',
      path: 'e2e-page-a',
      bodyText: '这是页面A正文',
    })
    pageB = await createPageRecord(app.request, {
      title: 'E2E 页面 B',
      path: 'e2e-page-b',
      bodyText: '这是页面B正文',
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

  test('从页面编辑页切回新建页会重置状态', async () => {
    const currentPage = page!

    await currentPage.goto(app!.adminUrl(`/pages/${pageA.id}`))
    await expect(currentPage.getByRole('textbox', { name: '标题', exact: true })).toHaveValue(
      pageA.title,
    )
    await expect(currentPage.getByRole('textbox', { name: '路径', exact: true })).toHaveValue(
      pageA.path,
    )
    await expectRichText(currentPage, '这是页面A正文')

    await pushClientRoute(currentPage, app!.adminUrl('/pages/new'))
    await expect(currentPage).toHaveURL(app!.adminUrl('/pages/new'))
    await expect(currentPage.getByRole('heading', { name: '新建页面' })).toBeVisible()
    await expect(currentPage.getByRole('textbox', { name: '标题', exact: true })).toHaveValue('')
    await expect(currentPage.getByRole('textbox', { name: '路径', exact: true })).toHaveValue('')
    await expect(currentPage.getByRole('combobox', { name: '模板' })).toHaveValue('默认（含头尾）')
    await expectRichTextEmpty(currentPage)
    await expect(currentPage.getByText('查看历史版本')).toHaveCount(0)
  })

  test('从页面 A 切到页面 B 不会残留旧内容', async () => {
    const currentPage = page!

    await currentPage.goto(app!.adminUrl(`/pages/${pageA.id}`))
    await expect(currentPage.getByRole('textbox', { name: '标题', exact: true })).toHaveValue(
      pageA.title,
    )
    await expectRichText(currentPage, '这是页面A正文')

    await pushClientRoute(currentPage, app!.adminUrl(`/pages/${pageB.id}`))
    await expect(currentPage).toHaveURL(app!.adminUrl(`/pages/${pageB.id}`))
    await expect(currentPage.getByRole('textbox', { name: '标题', exact: true })).toHaveValue(
      pageB.title,
    )
    await expect(currentPage.getByRole('textbox', { name: '路径', exact: true })).toHaveValue(
      pageB.path,
    )
    await expectRichText(currentPage, '这是页面B正文')
  })
})
