import type { TranslationValues } from '@/i18n/core'
import type { Locale } from '@/i18n/locales'
import type { HeadersLike } from '@/i18n/resolve-locale'
import { getServerTranslator } from '@/i18n/server'
import { NextResponse } from 'next/server'

type RequestLike = Request | HeadersLike

// 失败响应可携带的结构化语义提示。
// 所有 key 必须在 AGENTS.md「API 响应格式 / meta 字段」章节登记。
export interface JsonErrorMeta {
  /** 该次失败后前端是否应当立即刷新 captcha 输入。
   *  覆盖三种场景：(a) 缺 sessionId / (b) 缺 captchaCode / (c) verifyCaptcha 已消费 captcha 行。
   *  服务端不必精确区分三态——只要用户当前 captcha 状态已不可用就置 true。 */
  captchaShouldRefresh?: boolean
}

export interface JsonErrorOptions {
  source?: RequestLike
  locale?: Locale
  namespace?: string
  key: string
  values?: TranslationValues
  code: string
  status: number
  meta?: JsonErrorMeta
}

export async function jsonError({
  source,
  locale,
  namespace,
  key,
  values,
  code,
  status,
  meta,
}: JsonErrorOptions) {
  const { t } = await getServerTranslator(namespace, { locale, source })
  return NextResponse.json(
    {
      success: false,
      code,
      message: t(key, values),
      ...(meta ? { meta } : {}),
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
