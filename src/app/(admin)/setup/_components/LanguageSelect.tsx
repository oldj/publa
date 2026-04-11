'use client'

import { LOCALE_LABELS, SUPPORTED_LOCALES, type Locale } from '@/i18n/locales'
import { Select } from '@mantine/core'
import { usePathname, useRouter, useSearchParams } from 'next/navigation'
import { useCallback } from 'react'

interface LanguageSelectProps {
  value: Locale
  label?: string
}

/**
 * setup 页面的语言下拉：onChange 时通过 router.replace('?lang=xx') 更新 URL，
 * 驱动 RSC 重新渲染，从而同步 <html lang> 与页面文案。
 */
export function LanguageSelect({ value, label }: LanguageSelectProps) {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()

  const handleChange = useCallback(
    (next: string | null) => {
      if (!next || next === value) return
      const params = new URLSearchParams(searchParams?.toString() ?? '')
      params.set('lang', next)
      router.replace(`${pathname}?${params.toString()}`, { scroll: false })
    },
    [router, pathname, searchParams, value],
  )

  return (
    <Select
      label={label}
      value={value}
      onChange={handleChange}
      allowDeselect={false}
      data={SUPPORTED_LOCALES.map((l) => ({ value: l, label: LOCALE_LABELS[l] }))}
      radius="md"
    />
  )
}
