import type { Locale } from './locales'
import { loadMessages } from './load-messages'
import { createTranslator, type MessageTree } from './core'
import { resolveLocale, resolveLocaleFromHeaders, type HeadersLike } from './resolve-locale'

export interface ServerTranslatorOptions {
  locale?: Locale
  source?: Request | HeadersLike
}

function getHeadersLike(source: Request | HeadersLike | undefined): HeadersLike | undefined {
  if (!source) return undefined
  if ('headers' in source && source.headers && typeof source.headers.get === 'function') {
    return source.headers
  }
  if ('get' in source && typeof source.get === 'function') return source as HeadersLike
  return undefined
}

async function resolveServerLocale(options: ServerTranslatorOptions = {}): Promise<Locale> {
  if (options.locale) return options.locale

  const source = getHeadersLike(options.source)
  if (source) return resolveLocaleFromHeaders(source)

  return resolveLocale()
}

export async function getServerTranslator(
  namespace?: string,
  options: ServerTranslatorOptions = {},
): Promise<{
  locale: Locale
  messages: MessageTree
  t: ReturnType<typeof createTranslator>
}> {
  const locale = await resolveServerLocale(options)
  const messages = await loadMessages(locale)

  return {
    locale,
    messages,
    t: createTranslator(messages, locale, namespace),
  }
}
