/**
 * @author: oldj
 * @homepage: https://oldj.net
 */

'use client'

import { Menu } from '@mantine/core'
import clsx from 'clsx'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import styles from './nav.module.scss'

interface MenuItem {
  id: number
  title: string
  url: string
  target: string
  children?: MenuItem[]
}

interface Props {
  menus?: MenuItem[]
  siteTitle?: string
  siteSlogan?: string
}

const defaultMenus: MenuItem[] = [
  { id: 0, title: '首页', url: '/', target: '_self' },
  { id: 1, title: '文章', url: '/posts', target: '_self' },
  { id: 2, title: '留言', url: '/guestbook', target: '_self' },
  { id: 3, title: '关于', url: '/about', target: '_self' },
]

export default function Nav({
  menus,
  siteTitle = 'Publa',
  siteSlogan = 'Yet Another Amazing Blog',
}: Props) {
  const pathname = usePathname()
  const menuItems = menus && menus.length > 0 ? menus : defaultMenus

  const isActive = (url: string) => {
    if (!url) return false
    if (url === '/') return pathname === '/'
    return pathname.startsWith(url)
  }

  // 子菜单中任一项命中当前路径时，父菜单也标记为 active
  const isParentActive = (item: MenuItem) => {
    if (isActive(item.url)) return true
    return item.children?.some((child) => isActive(child.url)) ?? false
  }

  return (
    <div className={styles.root}>
      <div className={styles.header}>
        <Link href="/" className={styles.logo}>
          <h1 className={styles.site_title}>{siteTitle}</h1>
        </Link>
        <div className={styles.slogan}>{siteSlogan}</div>
      </div>

      <div className={styles.links}>
        {menuItems.map((item) =>
          item.children && item.children.length > 0 ? (
            <Menu key={item.id} trigger="hover" shadow="md" openDelay={100} closeDelay={200}>
              <Menu.Target>
                <span className={clsx(styles.menuTrigger, isParentActive(item) && styles.current)}>
                  {item.title}
                </span>
              </Menu.Target>
              <Menu.Dropdown>
                {item.children.map((child) => (
                  <Menu.Item
                    key={child.id}
                    component={Link}
                    href={child.url}
                    target={child.target === '_blank' ? '_blank' : undefined}
                    className={clsx(isActive(child.url) && styles.dropdownItemActive)}
                  >
                    {child.title}
                  </Menu.Item>
                ))}
              </Menu.Dropdown>
            </Menu>
          ) : (
            <Link
              key={item.id}
              href={item.url || '/'}
              target={item.target === '_blank' ? '_blank' : undefined}
              className={clsx(isActive(item.url) && styles.current)}
            >
              {item.title}
            </Link>
          ),
        )}
      </div>
    </div>
  )
}
