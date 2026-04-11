import { resolveLocale } from '@/i18n/resolve-locale'
import { SetupForm } from './_components/SetupForm'

export const dynamic = 'force-dynamic'

/**
 * Setup 页面的 Server Component 壳：
 * - 通过 resolveLocale() 解析当前 locale（内部已经考虑 ?lang= 覆盖）
 * - 把 locale 作为 prop 传给客户端表单；LanguageSelect 切换后 server 会重跑，
 *   prop 随之更新，客户端表单 state 保留
 * - 根布局已经根据同一个 resolveLocale 提供 NextIntlClientProvider，所以
 *   这里不需要再包一层 provider；<html lang> 与页面文案天然同步
 */
export default async function SetupPage() {
  const currentLocale = await resolveLocale()
  return <SetupForm currentLocale={currentLocale} />
}
