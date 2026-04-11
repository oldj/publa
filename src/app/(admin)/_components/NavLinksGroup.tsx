'use client'

import { Badge, Box, Collapse, Group, Text, ThemeIcon, UnstyledButton } from '@mantine/core'
import { IconChevronRight } from '@tabler/icons-react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useEffect, useState } from 'react'
import classes from './NavLinksGroup.module.scss'

const STORAGE_KEY = 'admin-nav-state'

function readNavState(label: string): boolean | null {
  if (typeof window === 'undefined') return null
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return null
    const state = JSON.parse(raw)
    return typeof state[label] === 'boolean' ? state[label] : null
  } catch {
    return null
  }
}

function writeNavState(label: string, opened: boolean) {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    const state = raw ? JSON.parse(raw) : {}
    state[label] = opened
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state))
  } catch {
    // 忽略存储异常
  }
}

export interface NavLink {
  id: string
  label: string
  link: string
  badge?: number
}

export interface NavLinksGroupProps {
  id: string
  icon: React.FC<{ size?: number | string; stroke?: number }>
  label: string
  link?: string
  initiallyOpened?: boolean
  links?: NavLink[]
}

export function NavLinksGroup({
  id,
  icon: Icon,
  label,
  link,
  initiallyOpened,
  links,
}: NavLinksGroupProps) {
  const pathname = usePathname()
  const hasLinks = Array.isArray(links) && links.length > 0
  // 先用路由推导的默认值渲染（与服务端一致），再从 localStorage 恢复
  const defaultOpened =
    initiallyOpened ||
    (hasLinks && links.some((l) => pathname === l.link || pathname.startsWith(l.link + '/')))
  const [opened, setOpened] = useState(defaultOpened)

  useEffect(() => {
    const saved = readNavState(id)
    if (saved !== null) setOpened(saved)
  }, [id])

  const toggleOpened = () => {
    setOpened((o) => {
      const next = !o
      writeNavState(id, next)
      return next
    })
  }

  const isActive = link ? pathname === link : false

  const items = hasLinks
    ? links.map((item) => (
        <Text
          component={Link}
          className={classes.link}
          href={item.link}
          key={item.label}
          data-active={pathname === item.link || pathname.startsWith(item.link + '/') || undefined}
          data-role={`admin-nav-link-${item.id}`}
        >
          <Group gap="xs" justify="space-between" wrap="nowrap">
            <span>{item.label}</span>
            {item.badge ? (
              <Badge size="sm" variant="filled" color="red" circle>
                {item.badge}
              </Badge>
            ) : null}
          </Group>
        </Text>
      ))
    : null

  if (link && !hasLinks) {
    return (
      <UnstyledButton
        component={Link}
        href={link}
        className={classes.control}
        data-active={isActive || undefined}
        data-role={`admin-nav-link-${id}`}
      >
        <Group gap={0} justify="space-between">
          <Box style={{ display: 'flex', alignItems: 'center' }}>
            <ThemeIcon variant="subtle" size={30}>
              <Icon size={18} />
            </ThemeIcon>
            <Box ml="6px">{label}</Box>
          </Box>
        </Group>
      </UnstyledButton>
    )
  }

  return (
    <>
      <UnstyledButton
        onClick={toggleOpened}
        className={classes.control}
        data-role={`admin-nav-group-${id}`}
      >
        <Group gap={0} justify="space-between">
          <Box style={{ display: 'flex', alignItems: 'center' }}>
            <ThemeIcon variant="subtle" size={30}>
              <Icon size={18} />
            </ThemeIcon>
            <Box ml="6px">{label}</Box>
          </Box>
          {hasLinks && (
            <IconChevronRight
              className={classes.chevron}
              size={16}
              stroke={1.5}
              style={{
                transform: opened ? 'rotate(90deg)' : 'none',
                transition: 'transform 200ms ease',
              }}
            />
          )}
        </Group>
      </UnstyledButton>
      {hasLinks && <Collapse expanded={opened}>{items}</Collapse>}
    </>
  )
}
