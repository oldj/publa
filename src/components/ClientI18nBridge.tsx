'use client'

import { setClientI18n } from '@/i18n/client-runtime'
import type { Locale } from '@/i18n/locales'
import { useLocale, useMessages } from 'next-intl'

export default function ClientI18nBridge() {
  const locale = useLocale() as Locale
  const messages = useMessages()

  setClientI18n(locale, messages)
  return null
}
