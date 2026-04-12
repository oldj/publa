import { getAllSettings } from '@/server/services/settings'
import { headers } from 'next/headers'
import { guessLocaleFromAcceptLanguage, isLocale, type Locale } from './locales'

export interface HeadersLike {
  get(name: string): string | null
}

/**
 * 服务端 locale 解析的唯一真理源。
 * 解析顺序：
 *   1) setup 页面的 ?lang= 覆盖（仅当 x-pathname 指向 /setup 时生效）
 *   2) 数据库 settings.language（try/catch 以兼容未初始化场景）
 *   3) Accept-Language 头猜测
 *   4) 默认 en
 */
export async function resolveLocale(): Promise<Locale> {
  try {
    return resolveLocaleFromHeaders(await headers())
  } catch {
    return resolveLocaleFromHeaders({
      get() {
        return null
      },
    })
  }
}

export async function resolveLocaleFromHeaders(h: HeadersLike): Promise<Locale> {
  const pathname = h.get('x-pathname') ?? ''
  const search = h.get('x-search') ?? ''

  // 1) setup 页面允许 ?lang= 覆盖，保证下拉切换时 <html lang> 与页面文案同步
  if (pathname.startsWith('/setup')) {
    const override = parseLangFromSearch(search)
    if (override) return override
  }

  // 2) 数据库设置
  try {
    const s = await getAllSettings()
    const lang = s.language
    if (isLocale(lang)) return lang
  } catch {
    // 数据库尚未初始化时直接降级
  }

  // 3) Accept-Language 头
  return guessLocaleFromAcceptLanguage(h.get('accept-language'))
}

function parseLangFromSearch(search: string): Locale | null {
  if (!search) return null
  const normalized = search.startsWith('?') ? search.slice(1) : search
  const params = new URLSearchParams(normalized)
  const lang = params.get('lang')
  return isLocale(lang) ? lang : null
}
