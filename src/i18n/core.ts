import { IntlMessageFormat } from 'intl-messageformat'
import type { Locale } from './locales'

export interface TranslationValues {
  [key: string]: string | number | boolean | Date | null | undefined
}

export type MessageTree = Record<string, unknown>
export type Translator = (key: string, values?: TranslationValues) => string

const formatterCache = new Map<string, IntlMessageFormat>()

function getFormatter(locale: Locale, message: string) {
  const cacheKey = `${locale}::${message}`
  const cached = formatterCache.get(cacheKey)
  if (cached) return cached

  const formatter = new IntlMessageFormat(message, locale)
  formatterCache.set(cacheKey, formatter)
  return formatter
}

export function getMessage(messages: MessageTree, path: string): unknown {
  return path.split('.').reduce<unknown>((current, key) => {
    if (!current || typeof current !== 'object') return undefined
    return (current as Record<string, unknown>)[key]
  }, messages)
}

export function formatMessage(
  locale: Locale,
  message: string,
  values?: TranslationValues,
): string {
  if (!values || Object.keys(values).length === 0) return message

  const formatter = getFormatter(locale, message)
  return String(formatter.format(values))
}

export function createTranslator(
  messages: MessageTree,
  locale: Locale,
  namespace?: string,
): Translator {
  return (key, values) => {
    const path = namespace ? `${namespace}.${key}` : key
    const message = getMessage(messages, path)
    if (typeof message !== 'string') {
      throw new Error(`Missing translation message: ${path}`)
    }
    return formatMessage(locale, message, values)
  }
}
