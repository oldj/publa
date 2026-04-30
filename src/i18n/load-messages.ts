import type { Locale } from './locales'

/**
 * 按 locale 动态加载 common/frontend/admin 三个命名空间。
 * 注意：next-intl 不会根据调用过的 namespace 自动裁剪客户端 bundle，
 * 客户端实际下发的子集在 src/i18n/request.ts 里按请求路径筛选。
 */
export async function loadMessages(locale: Locale) {
  const [common, frontend, admin] = await Promise.all([
    import(`../messages/${locale}/common.json`).then((m) => m.default),
    import(`../messages/${locale}/frontend.json`).then((m) => m.default),
    import(`../messages/${locale}/admin.json`).then((m) => m.default),
  ])

  return { common, frontend, admin }
}
