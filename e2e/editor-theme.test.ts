import path from 'node:path'
import { expect, test, type Locator } from '@playwright/test'
import { setupPerTestApp } from './helpers/app-instance'
import { richTextEditor } from './helpers/editor'

const typography = (node: Locator) =>
  node.evaluate((el) => {
    const { fontSize, color, lineHeight, marginBottom } = getComputedStyle(el)
    return { fontSize, color, lineHeight, marginBottom }
  })

test('富文本正文跟随主题和附加 CSS，普通模式占满宽度且工具栏隔离', async ({
  browser,
}, testInfo) => {
  const app = await setupPerTestApp(testInfo)
  const context = await browser.newContext({
    ...app.browserContextOptions,
    viewport: { width: 1600, height: 900 },
  })
  try {
    for (const file of ['KaTeX_Typewriter-Regular', 'KaTeX_Main-Regular']) {
      await context.route(`**/themes/${file}.woff2`, (route) =>
        route.fulfill({
          path: path.resolve('node_modules/katex/dist/fonts', file + '.woff2'),
          contentType: 'font/woff2',
        }),
      )
    }
    const page = await context.newPage()
    const front = await context.newPage()
    const html =
      '<p>第一段 iiiWWW</p><h2>章节标题</h2><h3>iiiWWW<em>iiiWWW</em></h3><p>第二段 <span data-type="inline-math" data-latex="x^2"></span></p>'
    const created = await app.request.post('/api/posts', {
      data: {
        title: '排版',
        slug: 'theme-test',
        status: 'published',
        contentType: 'richtext',
        contentRaw: html,
        contentHtml: html,
      },
    })
    const post = (await created.json()).data
    await page.goto(app.adminUrl('/posts/' + post.id))
    const editor = richTextEditor(page)
    const paragraph = editor.locator('p').first()
    await expect(paragraph).toHaveText('第一段 iiiWWW')
    const button = page.locator('.mantine-RichTextEditor-toolbar button').first()
    const originalButton = await typography(button)
    await expect(editor.locator('.katex-mathml')).toHaveCSS('position', 'absolute')

    const theme = await app.request.post('/api/themes', {
      data: {
        name: '排版测试主题',
        css: `
      @font-face {font-family: "Article, Face"; src: url("./KaTeX_Typewriter-Regular.woff2")}
      @font-face {font-family: red; src: url("./KaTeX_Typewriter-Regular.woff2")}
      @media (max-width: 799px) {
        @font-face {font-family: "Article, Face"; src: url("./KaTeX_Main-Regular.woff2")}
      }
      :root { --article-font: "Article, Face", serif; --ink: red; --heading-font: 21px red, sans-serif; --paragraph-gap: 1rem; font-size: 1.25rem }
      body[data-role="body"] .basic-layout > .basic-layout-body .post-detail > .rich-content {
        font-size: 1.1rem; color: var(--ink); font-family: var(--article-font); max-width: 420px !important;
      }
      .rich-content h2 { font: 500 1.5rem/1.2 var(--article-font); margin: var(--paragraph-gap) 0 .5rem }
      .rich-content h3 { font: var(--missing-font, var(--heading-font)) }
      @media (max-width: 100px) { :root { --inline-font: serif } }
      .rich-content h3 em { font-family: var(--inline-font, var(--ink)) }
      .rich-content p { line-height: 1.7; margin: 0 0 var(--paragraph-gap) }
      button { color: red !important; font-size: 42px !important }
    `,
      },
    })
    const style = await app.request.post('/api/custom-styles', {
      data: {
        name: '段距',
        css: `
      @media (min-width: 800px) { .rich-content p {margin-bottom: 1.5rem} }
    `,
      },
    })
    const settings = await app.request.put('/api/settings', {
      data: {
        activeThemeId: (await theme.json()).data.id,
        activeCustomStyleIds: [(await style.json()).data.id],
      },
    })
    expect((await settings.json()).success).toBe(true)
    await Promise.all([page.reload(), front.goto('/posts/theme-test')])
    const publishedParagraph = front.locator('.post-detail-content p').first()
    await expect(publishedParagraph).toHaveCSS('margin-bottom', '30px')
    await expect.poll(() => typography(paragraph)).toEqual(await typography(publishedParagraph))
    const heading = editor.locator('h2')
    const publishedHeading = front.locator('.post-detail-content h2')
    await expect.poll(() => typography(heading)).toEqual(await typography(publishedHeading))
    const textWidth = (node: Locator) =>
      node.evaluate(async (el) => {
        await el.ownerDocument.fonts.ready
        const range = el.ownerDocument.createRange()
        range.selectNodeContents(el)
        return range.getBoundingClientRect().width
      })
    const textWidthDifference = async () => {
      const [editing, published] = await Promise.all([
        textWidth(paragraph),
        textWidth(publishedParagraph),
      ])
      return Math.abs(editing - published)
    }
    await expect.poll(textWidthDifference).toBeLessThan(0.05)
    // 同一个变量既可用作颜色也可用作字体族；完整的 font 简写也可通过变量回退取值。
    const subheading = editor.locator('h3')
    const publishedSubheading = front.locator('.post-detail-content h3')
    await expect(subheading).toHaveCSS('color', 'rgb(255, 0, 0)')
    await expect
      .poll(async () =>
        Math.abs((await textWidth(subheading)) - (await textWidth(publishedSubheading))),
      )
      .toBeLessThan(0.05)
    // 媒体条件未命中时仍继承行内定义，并优先于 var() 的字体回退。
    await page
      .locator('[data-role="rich-text-editor"]')
      .evaluate((el) => el.style.setProperty('--inline-font', 'monospace'))
    await expect(subheading.locator('em')).toHaveCSS('font-family', 'monospace')
    expect(await typography(button)).toEqual(originalButton)
    const outer = await page.locator('[data-role="rich-text-editor"]').boundingBox()
    const inner = await paragraph.boundingBox()
    expect(inner!.width).toBeGreaterThan(720)
    expect(inner!.width).toBeCloseTo(outer!.width - 32, 0)

    await page.getByRole('button', { name: '最大化', exact: true }).click()
    await page.getByRole('button', { name: '限宽阅读', exact: true }).click()
    expect((await paragraph.boundingBox())!.width).toBeLessThan(720)
    await page.getByRole('button', { name: '退出最大化', exact: true }).click()
    expect((await paragraph.boundingBox())!.width).toBeCloseTo(inner!.width, 0)

    await page.setViewportSize({ width: 390, height: 800 })
    await front.setViewportSize({ width: 390, height: 800 })
    await expect(publishedParagraph).toHaveCSS('margin-bottom', '20px')
    await expect.poll(() => typography(paragraph)).toEqual(await typography(publishedParagraph))
    await expect.poll(textWidthDifference).toBeLessThan(0.05)
    await paragraph.click()
    await button.click()
    await page.keyboard.type('abc')
    await expect(paragraph.locator('strong')).toHaveText('abc')
  } finally {
    await context.close()
    await app.cleanup({ removeArtifacts: true })
  }
})

test('普通编辑区滚动时表格工具栏跟随选区，移出可见区域后收起', async ({ browser }, testInfo) => {
  const app = await setupPerTestApp(testInfo)
  const context = await browser.newContext({
    ...app.browserContextOptions,
    viewport: { width: 1440, height: 1000 },
  })
  try {
    const page = await context.newPage()
    const content =
      '<p>前文</p>'.repeat(12) +
      '<table><tbody><tr><td><p>单元格</p></td></tr></tbody></table>' +
      '<p>后文</p>'.repeat(30)
    const response = await app.request.post('/api/posts', {
      data: {
        title: '表格',
        slug: 'table-scroll',
        contentType: 'richtext',
        contentHtml: content,
        contentRaw: content,
      },
    })
    const { data } = await response.json()
    await page.goto(app.adminUrl('/posts/' + data.id))
    const surface = page.locator('[data-role="rich-text-editor"]')
    const cell = richTextEditor(page).locator('td').first()
    await expect
      .poll(async () => parseFloat((await typography(cell.locator('p'))).lineHeight))
      .toBeCloseTo(28.8, 2)
    await cell.evaluate((el) => el.scrollIntoView({ block: 'center' }))
    await cell.click()
    const menu = page.locator('.image-bubble-menu')
    await expect(menu).toBeVisible()
    // 居中时菜单位于表格上方（预留高度 36px，间距 4px）。菜单可见后滚动仍可能尚未稳定。
    const table = richTextEditor(page).locator('.tableWrapper').first()
    const distance = () =>
      table.evaluate((el) => {
        const menu = document.querySelector('.image-bubble-menu')
        if (!menu) return null
        return el.getBoundingClientRect().top - menu.getBoundingClientRect().top
      })
    await expect.poll(distance).toBeCloseTo(40, 0)
    await surface.evaluate((el) => {
      el.scrollTop += 90
    })
    await expect.poll(distance).toBeCloseTo(40, 0)
    await surface.evaluate((el) => {
      el.scrollTop = el.scrollHeight
    })
    await expect(menu).toBeHidden()
  } finally {
    await context.close()
    await app.cleanup({ removeArtifacts: true })
  }
})

test('空白模板使用发布页的默认排版，切换模板时保留正文', async ({ browser }, testInfo) => {
  const app = await setupPerTestApp(testInfo)
  const context = await browser.newContext(app.browserContextOptions)
  try {
    const page = await context.newPage()
    const front = await context.newPage()
    const html = '<p>模板切换</p>'
    const res = await app.request.post('/api/pages', {
      data: {
        title: '空白页面',
        path: 'plain-layout',
        template: 'blank',
        mimeType: 'text/html',
        status: 'published',
        contentType: 'richtext',
        contentHtml: html,
        contentRaw: html,
      },
    })
    const { data } = await res.json()
    await Promise.all([page.goto(app.adminUrl('/pages/' + data.id)), front.goto('/plain-layout')])
    const para = richTextEditor(page).locator('p').first()
    const published = await typography(front.locator('p').first())
    await expect.poll(() => typography(para)).toEqual(published)
    const select = page.locator('[data-role="page-template-input"]')
    await select.click()
    await page.getByRole('option', { name: '默认（含头尾）' }).click()
    await expect
      .poll(async () => parseFloat((await typography(para)).lineHeight))
      .toBeCloseTo(28.8, 2)
    await select.click()
    await page.getByRole('option', { name: '空白', exact: true }).click()
    await expect.poll(() => typography(para)).toEqual(published)
    await expect(para).toHaveText('模板切换')
  } finally {
    await context.close()
    await app.cleanup({ removeArtifacts: true })
  }
})

test('编辑器跳过不可读的 CDN 样式并加载允许跨域读取的公式样式', async ({ browser }, testInfo) => {
  const app = await setupPerTestApp(testInfo)
  const context = await browser.newContext(app.browserContextOptions)
  try {
    const page = await context.newPage()
    await page.goto(app.adminUrl('/posts'))
    // 同一个测试服务使用另一主机名，模拟部署在 CDN 上的静态资源。
    const cdn = new URL(app.baseURL)
    cdn.hostname = 'localhost'
    const redirect = await app.request.post('/api/redirect-rules', {
      data: {
        pathRegex: '^/uploads/editor-redirect[.]css$',
        redirectTo: new URL('/themes/light.css', cdn).href,
        redirectType: '302',
      },
    })
    expect(redirect.ok()).toBe(true)
    await page.addStyleTag({ url: '/uploads/editor-redirect.css' })

    const mathUrl = new URL('/editor-math.css', cdn).href
    await page.route(mathUrl, (route) =>
      route.fulfill({
        headers: { 'Access-Control-Allow-Origin': '*', 'Content-Type': 'text/css' },
        body: '@layer publa-editor-math { .ProseMirror { --cdn-math-loaded:yes; } }',
      }),
    )
    await page.evaluate(
      (url) =>
        new Promise<void>((resolve, reject) => {
          const link = document.createElement('link')
          link.rel = 'stylesheet'
          link.crossOrigin = 'anonymous'
          link.href = url
          link.onload = () => resolve()
          link.onerror = () => reject(new Error('Failed to load test stylesheet'))
          document.head.append(link)
        }),
      mathUrl,
    )

    await page.locator('[data-role="admin-posts-new-button"]').click()
    const editor = richTextEditor(page)
    await expect(editor).toHaveCSS('--cdn-math-loaded', 'yes')
    await editor.locator('p').first().click()
    await page.keyboard.type('cdn')
    await expect(editor).toHaveText('cdn')
  } finally {
    await context.close()
    await app.cleanup({ removeArtifacts: testInfo.status === 'passed' })
  }
})
