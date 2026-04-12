import { getServerTranslator } from '@/i18n/server'
import type { HeadersLike } from '@/i18n/resolve-locale'
import type { Locale } from '@/i18n/locales'
import type { TranslationValues } from '@/i18n/core'
import { NextResponse } from 'next/server'

type RequestLike = Request | HeadersLike

export interface JsonErrorOptions {
  source?: RequestLike
  locale?: Locale
  namespace?: string
  key: string
  values?: TranslationValues
  code: string
  status: number
}

export async function jsonError({
  source,
  locale,
  namespace,
  key,
  values,
  code,
  status,
}: JsonErrorOptions) {
  const { t } = await getServerTranslator(namespace, { locale, source })
  return NextResponse.json(
    {
      success: false,
      code,
      message: t(key, values),
    },
    { status },
  )
}

export function jsonSuccess(data?: unknown, init?: globalThis.ResponseInit) {
  if (data === undefined) {
    return NextResponse.json({ success: true }, init)
  }

  return NextResponse.json({ success: true, data }, init)
}
