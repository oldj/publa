import type { BrowserContext, Page } from '@playwright/test'

async function closeQuietly(target: { close: () => Promise<void> } | null | undefined) {
  if (!target) return

  try {
    await target.close()
  } catch {
    // 测试超时或浏览器已被 Playwright 回收时，静默忽略二次关闭错误。
  }
}

export async function closePageAndContext(page: Page | null, context: BrowserContext | null) {
  await closeQuietly(page)
  await closeQuietly(context)
}
