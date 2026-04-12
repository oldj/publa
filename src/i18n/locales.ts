export const SUPPORTED_LOCALES = ['zh', 'en'] as const

export type Locale = (typeof SUPPORTED_LOCALES)[number]

export const DEFAULT_LOCALE: Locale = 'en'

export const LOCALE_LABELS: Record<Locale, string> = {
  zh: '简体中文',
  en: 'English',
}

export function isLocale(value: unknown): value is Locale {
  return typeof value === 'string' && (SUPPORTED_LOCALES as readonly string[]).includes(value)
}

/** 根据 Accept-Language 头猜一个最接近的受支持 locale */
export function guessLocaleFromAcceptLanguage(header: string | null | undefined): Locale {
  if (!header) return DEFAULT_LOCALE
  const first = header.split(',')[0]?.trim().toLowerCase() ?? ''
  if (first.startsWith('zh')) return 'zh'
  return DEFAULT_LOCALE
}
