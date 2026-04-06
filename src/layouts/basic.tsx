/**
 * @author: oldj
 * @homepage: https://oldj.net
 */

import { getMenuTree } from '@/server/services/menus'
import { getFrontendCategories, getFrontendTags } from '@/server/services/posts-frontend'
import { getSetting } from '@/server/services/settings'
import React from 'react'
import Footer from 'src/components/footer'
import Nav from 'src/components/nav'
import '@/styles/themes/oj-2025.css'

interface IProps {
  children?: React.ReactNode
}

export default async function BasicLayout(props: IProps) {
  const { children } = props
  const { categories, tags, menus, siteTitle, siteSlogan, footerCopyright } = await getData()

  return (
    <>
      <div className="basic-layout">
        <Nav menus={menus} siteTitle={siteTitle} siteSlogan={siteSlogan} />
        <main className="basic-layout-body">{children}</main>
      </div>

      <Footer categories={categories || []} tags={tags || []} footerCopyright={footerCopyright} />
    </>
  )
}

async function getData() {
  const categories = await getFrontendCategories()
  const tags = await getFrontendTags()
  const menus = await getMenuTree()
  const siteTitle = (await getSetting('siteTitle')) || 'Publa'
  const siteSlogan = (await getSetting('siteSlogan')) || 'Yet Another Amazing Blog'
  const year = String(new Date().getFullYear())
  const rawCopyright = (await getSetting('footerCopyright')) || '{SITE_NAME} &copy; {FULL_YEAR}'
  const footerCopyright = rawCopyright
    .replace(/\{SITE_NAME}/g, siteTitle)
    .replace(/\{FULL_YEAR}/g, year)

  return {
    categories: categories || [],
    tags: tags || [],
    menus,
    siteTitle,
    siteSlogan,
    footerCopyright,
  }
}
