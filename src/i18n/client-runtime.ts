'use client'

import { createTranslator, type MessageTree, type Translator } from './core'
import type { Locale } from './locales'

let currentLocale: Locale = 'en'
let currentMessages: MessageTree | null = null
let cachedTranslators = new Map<string, Translator>()

export function setClientI18n(locale: Locale, messages: MessageTree) {
  currentLocale = locale
  currentMessages = messages
  cachedTranslators.clear()
}

export function getClientTranslator(namespace?: string): Translator {
  return (key, values) => {
    if (!currentMessages) {
      return namespace ? `${namespace}.${key}` : key
    }

    const cacheKey = namespace ?? ''
    let t = cachedTranslators.get(cacheKey)
    if (!t) {
      t = createTranslator(currentMessages, currentLocale, namespace)
      cachedTranslators.set(cacheKey, t)
    }
    return t(key, values)
  }
}
