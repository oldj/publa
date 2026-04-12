'use client'

import { createTranslator, type MessageTree, type Translator } from './core'
import type { Locale } from './locales'

let currentLocale: Locale = 'en'
let currentMessages: MessageTree | null = null

export function setClientI18n(locale: Locale, messages: MessageTree) {
  currentLocale = locale
  currentMessages = messages
}

export function getClientTranslator(namespace?: string): Translator {
  return (key, values) => {
    if (!currentMessages) {
      return namespace ? `${namespace}.${key}` : key
    }

    return createTranslator(currentMessages, currentLocale, namespace)(key, values)
  }
}
