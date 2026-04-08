/**
 * @author: oldj
 * @homepage: https://oldj.net
 */

'use client'

import clsx from 'clsx'
import Link from 'next/link'
import { usePathname } from 'next/navigation'

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

  // 收集所有内部菜单 URL（排除外链和空白）
  const internalUrls = menuItems.flatMap((item) => {
    const urls: string[] = []
    if (item.url && !item.url.startsWith('http') && item.target !== '_blank') {
      urls.push(item.url)
    }
    if (item.children) {
      item.children.forEach((child) => {
        if (child.url && !child.url.startsWith('http') && child.target !== '_blank') {
          urls.push(child.url)
        }
      })
    }
    return urls
  })

  // 是否有任何非 `/` 的内部菜单项匹配当前路径
  const hasNonRootMatch = internalUrls
    .filter((url) => url !== '/')
    .some((url) => pathname.startsWith(url))

  const isActive = (url: string) => {
    if (!url) return false
    if (url === '/') {
      // 精确匹配，或没有其他菜单项匹配时作为兜底
      return pathname === '/' || !hasNonRootMatch
    }
    return pathname.startsWith(url)
  }

  // 子菜单中任一项命中当前路径时，父菜单也标记为 active
  const isParentActive = (item: MenuItem) => {
    if (isActive(item.url)) return true
    return item.children?.some((child) => isActive(child.url)) ?? false
  }

  // 根据视口空间决定下拉面板的对齐方向
  const positionDropdown = (e: React.MouseEvent<HTMLDivElement>) => {
    const container = e.currentTarget
    const menu = container.querySelector<HTMLElement>('.site-nav-dropdown-menu')
    if (!menu) return

    container.classList.remove('site-nav-dropdown--top')

    // 临时显示以测量尺寸
    menu.style.visibility = 'hidden'
    menu.style.display = 'flex'
    const menuRect = menu.getBoundingClientRect()
    menu.style.display = ''
    menu.style.visibility = ''

    // 下方溢出且上方有足够空间则改为上弹
    if (menuRect.bottom > window.innerHeight) {
      const triggerRect = container.getBoundingClientRect()
      if (triggerRect.top >= menuRect.height) {
        container.classList.add('site-nav-dropdown--top')
      }
    }
  }

  return (
    <div className="site-nav">
      <div className="site-nav-header">
        <Link href="/">
          <h1 className="site-nav-title">{siteTitle}</h1>
        </Link>
        <div className="site-nav-slogan">{siteSlogan}</div>
      </div>

      <div className="site-nav-links">
        {menuItems.map((item) =>
          item.children && item.children.length > 0 ? (
            <div key={item.id} className="site-nav-dropdown" onMouseEnter={positionDropdown}>
              <span
                className={clsx('site-nav-trigger', isParentActive(item) && 'site-nav-current')}
              >
                {item.title}
              </span>
              <div className="site-nav-dropdown-menu">
                {item.children.map((child) => (
                  <Link
                    key={child.id}
                    href={child.url}
                    target={child.target === '_blank' ? '_blank' : undefined}
                    className={clsx(
                      'site-nav-dropdown-item',
                      isActive(child.url) && 'site-nav-dropdown-active',
                    )}
                  >
                    {child.title}
                  </Link>
                ))}
              </div>
            </div>
          ) : (
            <Link
              key={item.id}
              href={item.url || '/'}
              target={item.target === '_blank' ? '_blank' : undefined}
              className={clsx(isActive(item.url) && 'site-nav-current')}
            >
              {item.title}
            </Link>
          ),
        )}
      </div>
    </div>
  )
}
