/**
 * @author: oldj
 * @homepage: https://oldj.net
 */

import { getMenuTree } from '@/server/services/menus'
import { getFrontendCategories, getFrontendTags } from '@/server/services/posts-frontend'
import { getSetting, toBool, toStr } from '@/server/services/settings'
import React from 'react'
import Footer from 'src/components/footer'
import Nav from 'src/components/nav'

interface IProps {
  children?: React.ReactNode
}

export default async function BasicLayout(props: IProps) {
  const { children } = props
  const {
    categories,
    tags,
    menus,
    siteTitle,
    siteSlogan,
    footerCopyright,
    customBodyStartHtml,
    customBodyEndHtml,
    enableSearch,
  } = await getData()

  return (
    <>
      {customBodyStartHtml && <div dangerouslySetInnerHTML={{ __html: customBodyStartHtml }} />}

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
      {customBodyEndHtml && <div dangerouslySetInnerHTML={{ __html: customBodyEndHtml }} />}
    </>
  )
}

async function getData() {
  const categories = await getFrontendCategories()
  const tags = await getFrontendTags()
  const menus = await getMenuTree()
  const siteTitle = toStr(await getSetting('siteTitle'), 'Publa')
  const siteSlogan = toStr(await getSetting('siteSlogan'), 'Yet Another Amazing Blog')
  const year = String(new Date().getFullYear())
  const rawCopyright = toStr(await getSetting('footerCopyright'), '{SITE_NAME} &copy; {FULL_YEAR}')
  const footerCopyright = rawCopyright
    .replace(/\{SITE_NAME}/g, siteTitle)
    .replace(/\{FULL_YEAR}/g, year)

  const customBodyStartHtml = toStr(await getSetting('customBodyStartHtml'))
  const customBodyEndHtml = toStr(await getSetting('customBodyEndHtml'))
  const enableSearch = toBool(await getSetting('enableSearch'), false)

  return {
    categories: categories || [],
    tags: tags || [],
    menus,
    siteTitle,
    siteSlogan,
    footerCopyright,
    customBodyStartHtml,
    customBodyEndHtml,
    enableSearch,
  }
}
