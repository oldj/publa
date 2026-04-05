'use client'

import { Button, Input } from '@mantine/core'

type ContentType = 'richtext' | 'markdown' | 'html'

interface ContentTypeSelectorProps {
  value: ContentType
  onChange: (value: ContentType) => void
  disabled?: boolean
}

const data = [
  { value: 'richtext', label: '富文本' },
  { value: 'markdown', label: 'Markdown' },
  { value: 'html', label: 'HTML' },
]

export default function ContentTypeSelector({
  value,
  onChange,
  disabled,
}: ContentTypeSelectorProps) {
  return (
    <Input.Wrapper label="内容类型">
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
