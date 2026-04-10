import { expect, type Page } from '@playwright/test'

declare global {
  interface Window {
    __PUBLA_E2E_ROUTER_PUSH?: (href: string) => void
  }
}

export function richTextEditor(page: Page) {
  return page.locator('[data-role="rich-text-editor"] [contenteditable="true"]').first()
}

export async function readRichText(page: Page): Promise<string> {
  const text = await richTextEditor(page).textContent()
  return (text || '').replace(/\u200b/g, '').trim()
}

export async function expectRichText(page: Page, expected: string) {
  await expect.poll(async () => readRichText(page)).toBe(expected)
}

export async function expectRichTextEmpty(page: Page) {
  await expect.poll(async () => readRichText(page)).toBe('')
}

export async function pushClientRoute(page: Page, href: string) {
  await page.evaluate((targetHref) => {
    const push = window.__PUBLA_E2E_ROUTER_PUSH
    if (!push) {
      throw new Error('E2E router bridge is unavailable')
    }

    push(targetHref)
  }, href)
}
