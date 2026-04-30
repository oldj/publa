import { headers } from 'next/headers'
import { getRequestConfig } from 'next-intl/server'
import { loadMessages } from './load-messages'
import { resolveLocale } from './resolve-locale'

export default getRequestConfig(async () => {
  const locale = await resolveLocale()
  const all = await loadMessages(locale)

  // 根据请求路径裁剪客户端可见的 messages：前台路由不下发 admin 命名空间，
  // 避免把后台所有文案序列化进 RSC payload 暴露给公开页面。
  // x-pathname 由 src/proxy.ts 注入；自定义后台路径已被 rewrite 成 /admin/*，
  // 所以这里判断对默认与自定义后台路径同样有效。
  const headersList = await headers()
  const pathname = headersList.get('x-pathname') || ''
  const needsAdmin = pathname.startsWith('/admin') || pathname.startsWith('/setup')

  const messages = needsAdmin ? all : { common: all.common, frontend: all.frontend }
  return { locale, messages }
})
