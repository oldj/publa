import PreviewNotice from '@/components/PreviewNotice'
import BasicLayout from '@/layouts/basic'
import { getCurrentUser } from '@/server/auth'
import { redirectOrNotFound } from '@/server/lib/frontend-404'
import { getPublishedPageByPath } from '@/server/services/pages'
import { parsePreviewId, getPreviewPage } from '@/server/services/preview'
import { Metadata } from 'next'
import { notFound } from 'next/navigation'
import styles from './page.module.scss'

export async function generateMetadata({
  params,
}: {
  params: Promise<{ path: string[] }>
}): Promise<Metadata> {
  const { path } = await params
  const pagePath = path.join('/')

  // 预览模式：通过 ID 获取页面
  const previewId = parsePreviewId(pagePath)
  if (previewId !== null) {
    const user = await getCurrentUser()
    if (!user) return { title: '页面不存在' }
    const page = await getPreviewPage(previewId)
    return {
      title: page?.seoTitle || page?.title || '页面不存在',
      description: page?.seoDescription || undefined,
    }
  }

  const page = await getPublishedPageByPath(pagePath)

  return {
    title: page?.seoTitle || page?.title || '页面不存在',
    description: page?.seoDescription || undefined,
  }
}

export default async function DynamicPage({ params }: { params: Promise<{ path: string[] }> }) {
  const { path } = await params
  const pagePath = path.join('/')
  const pathname = `/${pagePath}`

  // 保留路径不能被页面系统覆盖
  const reserved = ['admin', 'api', 'setup', '_next']
  if (reserved.includes(path[0])) {
    notFound()
  }

  // 预览模式：通过 ID 获取页面，需要登录
  const previewId = parsePreviewId(pagePath)
  if (previewId !== null) {
    const user = await getCurrentUser()
    if (!user) notFound()
    const page = await getPreviewPage(previewId)
    if (!page) notFound()

    if (page.template === 'blank') {
      return (
        <>
          <PreviewNotice />
          <div
            className={styles.content}
            dangerouslySetInnerHTML={{ __html: page.contentHtml }}
          />
        </>
      )
    }

    return (
      <BasicLayout>
        <PreviewNotice />
        <div className={styles.root}>
          <div
            className={styles.content}
            dangerouslySetInnerHTML={{ __html: page.contentHtml }}
          />
        </div>
      </BasicLayout>
    )
  }

  const page = await getPublishedPageByPath(pagePath)
  if (!page) {
    return redirectOrNotFound(pathname)
  }

  // blank 模板：不包含头尾
  if (page.template === 'blank') {
    return <div className={styles.content} dangerouslySetInnerHTML={{ __html: page.contentHtml }} />
  }

  // default 模板：包含 BasicLayout
  return (
    <BasicLayout>
      <div className={styles.root}>
        <div className={styles.content} dangerouslySetInnerHTML={{ __html: page.contentHtml }} />
      </div>
    </BasicLayout>
  )
}
