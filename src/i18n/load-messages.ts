import type { Locale } from './locales'

/**
 * 按 locale 动态加载 common/frontend/admin 三个命名空间。
 *
 * 注意：next-intl 不会根据调用过的 namespace 自动裁剪客户端 bundle，
 * 客户端 RSC payload 的 namespace 裁剪只在 src/i18n/request.ts 里按
 * 请求路径执行。本函数始终返回完整三个命名空间，server-side translator
 * (`getServerTranslator`)、API 路由、路由 metadata 等直接调用方都拿
 * 完整数据，不受裁剪影响。
 */
export async function loadMessages(locale: Locale) {
  const [common, frontend, admin] = await Promise.all([
    import(`../messages/${locale}/common.json`).then((m) => m.default),
    import(`../messages/${locale}/frontend.json`).then((m) => m.default),
    import(`../messages/${locale}/admin.json`).then((m) => m.default),
  ])

  return { common, frontend, admin }
}
