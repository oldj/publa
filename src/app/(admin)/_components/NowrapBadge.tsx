import { Badge, type BadgeProps } from '@mantine/core'

/**
 * 不可压缩的 Badge，覆盖了 overflow: hidden，
 * 适用于表格等需要按内容宽度自适应的场景。
 */
const nowrapStyles = {
  root: { overflow: 'visible' as const },
  label: { overflow: 'visible' as const },
}

export function NowrapBadge(props: BadgeProps & React.ComponentPropsWithoutRef<'div'>) {
  return <Badge styles={nowrapStyles} {...props} />
}
