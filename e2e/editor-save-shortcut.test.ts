import { expect, test } from '@playwright/test'
import { setupPerTestApp } from './helpers/app-instance'
import { createPostRecord } from './helpers/content'
import { richTextEditor } from './helpers/editor'

test.use({ browserName: 'firefox' })

test('在富文本正文中按一次保存快捷键只写入一次草稿', async ({ browser }, testInfo) => {
  const app = await setupPerTestApp(testInfo)
  const context = await browser.newContext(app.browserContextOptions)
  try {
    const post = await createPostRecord(app.request, {
      title: '快捷键保存',
      slug: 'save-shortcut',
      bodyText: '草稿正文',
    })
    const page = await context.newPage()
    await page.goto(app.adminUrl('/posts/' + post.id))
    const editor = richTextEditor(page)
    await expect(editor).toHaveText('草稿正文')
    await editor.click()
    await page.keyboard.type('abc')

    const draftUrl = new URL(`/api/posts/${post.id}/draft`, app.baseURL).href
    let saves = 0
    page.on('request', (request) => {
      if (request.method() === 'PUT' && request.url() === draftUrl) saves++
    })
    const saved = page.waitForResponse(
      (response) => response.url() === draftUrl && response.request().method() === 'PUT',
    )
    await page.keyboard.press('ControlOrMeta+s')
    expect((await saved).ok()).toBe(true)
    expect(saves).toBe(1)
  } finally {
    await context.close()
    await app.cleanup({ removeArtifacts: true })
  }
})
