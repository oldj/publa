'use client'

import { Button, Input } from '@mantine/core'
import { useTranslations } from 'next-intl'

type ContentType = 'richtext' | 'markdown' | 'html'

interface ContentTypeSelectorProps {
  value: ContentType
  onChange: (value: ContentType) => void
  disabled?: boolean
}

export default function ContentTypeSelector({
  value,
  onChange,
  disabled,
}: ContentTypeSelectorProps) {
  const t = useTranslations('admin.editor.contentTypeSelector')
  const data = [
    { value: 'richtext', label: t('richtext') },
    { value: 'markdown', label: 'Markdown' },
    { value: 'html', label: 'HTML' },
  ]

  return (
    <Input.Wrapper label={t('label')}>
      <Button.Group mt={0}>
        {data.map((item) => (
          <Button
            key={item.value}
            variant={value === item.value ? 'filled' : 'default'}
            onClick={() => onChange(item.value as ContentType)}
            disabled={disabled}
          >
            {item.label}
          </Button>
        ))}
      </Button.Group>
    </Input.Wrapper>
  )
}
