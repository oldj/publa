/**
 * @author: oldj
 * @homepage: https://oldj.net
 */

import Footer from '@/components/footer'
import Nav from '@/components/nav'
import BlankLayout from '@/layouts/blank'
import { getMenuTree } from '@/server/services/menus'
import { getFrontendCategories, getFrontendTags } from '@/server/services/posts-frontend'
import { getAllSettings, toBool, toStr } from '@/server/services/settings'
import React from 'react'

interface IProps {
  children?: React.ReactNode
}

export default async function BasicLayout(props: IProps) {
  const { children } = props
  const { categories, tags, menus, siteTitle, siteSlogan, footerCopyright, enableSearch } =
    await getData()

  return (
    <BlankLayout>
      <div className="basic-layout">
        <Nav menus={menus} siteTitle={siteTitle} siteSlogan={siteSlogan} />
        <main className="basic-layout-body">{children}</main>
      </div>

      <Footer
        categories={categories || []}
        tags={tags || []}
        footerCopyright={footerCopyright}
        enableSearch={enableSearch}
      />
    </BlankLayout>
  )
}

async function getData() {
  // 通过 React cache 记忆化的 getAllSettings，一次请求内多层布局共享同一份设置快照
  const s = await getAllSettings()

  const categories = await getFrontendCategories()
  const tags = await getFrontendTags()
  const menus = await getMenuTree()
  const siteTitle = toStr(s.siteTitle, 'Publa')
  const siteSlogan = toStr(s.siteSlogan, 'Yet Another Amazing Blog')
  const year = String(new Date().getFullYear())
  const rawCopyright = toStr(s.footerCopyright, '{SITE_NAME} &copy; {FULL_YEAR}')
  const footerCopyright = rawCopyright
    .replace(/\{SITE_NAME}/g, siteTitle)
    .replace(/\{FULL_YEAR}/g, year)

  const enableSearch = toBool(s.enableSearch, false)

  return {
    categories: categories || [],
    tags: tags || [],
    menus,
    siteTitle,
    siteSlogan,
    footerCopyright,
    enableSearch,
  }
}
