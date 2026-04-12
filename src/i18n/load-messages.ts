import type { Locale } from './locales'

/**
 * 按 locale 动态加载并合并 common/frontend/admin 三个命名空间。
 * next-intl 会按顶层 key 分隔命名空间，调用 useTranslations('admin.shell') 时只会
 * 读取对应子树，避免把未使用的翻译打进客户端 bundle。
 */
export async function loadMessages(locale: Locale) {
  const [common, frontend, admin] = await Promise.all([
    import(`../messages/${locale}/common.json`).then((m) => m.default),
    import(`../messages/${locale}/frontend.json`).then((m) => m.default),
    import(`../messages/${locale}/admin.json`).then((m) => m.default),
  ])

  return { common, frontend, admin }
}
