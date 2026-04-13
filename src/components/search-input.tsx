'use client'

import { useTranslations } from 'next-intl'
import { useState } from 'react'

interface Props {
  defaultValue?: string
}

export default function SearchInput(props: Props) {
  const { defaultValue = '' } = props
  const t = useTranslations('frontend.search')
  const [value, setValue] = useState(defaultValue)

  return (
    <form action="/search" method="GET" className="search-form">
      <input
        type="text"
        name="q"
        value={value}
        placeholder={t('placeholder')}
        onChange={(e) => setValue(e.target.value)}
        autoFocus={!defaultValue}
      />
      <button type="submit">{t('button')}</button>
    </form>
  )
}
