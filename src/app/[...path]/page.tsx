import PreviewNotice from '@/components/PreviewNotice'
import TwitterEmbedResize from '@/components/TwitterEmbedResize'
import { getServerTranslator } from '@/i18n/server'
import BasicLayout from '@/layouts/basic'
import BlankLayout from '@/layouts/blank'
import applyRichTextPipeline from '@/lib/applyRichTextPipeline'
import { getCurrentUser } from '@/server/auth'
import { redirectOrNotFound } from '@/server/lib/frontend-404'
import { getPublishedPageByPath } from '@/server/services/pages'
import { getPreviewPage, parsePreviewId } from '@/server/services/preview'
import { Metadata } from 'next'
import { notFound } from 'next/navigation'

export async function generateMetadata({
  params,
}: {
  params: Promise<{ path: string[] }>
}): Promise<Metadata> {
  const { path } = await params
  const pagePath = path.join('/')
  const { t } = await getServerTranslator('frontend.dynamicPage')

  // 预览模式：通过 ID 获取页面
  const previewId = parsePreviewId(pagePath)
  if (previewId !== null) {
    const user = await getCurrentUser()
    if (!user) return { title: t('notFoundTitle') }
    const page = await getPreviewPage(previewId)
    return {
      title: page?.seoTitle || page?.title || t('notFoundTitle'),
      description: page?.seoDescription || undefined,
    }
  }

  const page = await getPublishedPageByPath(pagePath)

  return {
    title: page?.seoTitle || page?.title || t('notFoundTitle'),
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

    const contentHtml = applyRichTextPipeline(page.contentHtml)

    if (page.template === 'blank') {
      // blank 模板不渲染 Nav/Footer，但仍需经过 BlankLayout 注入主题 CSS 与 custom body HTML
      return (
        <BlankLayout>
          <PreviewNotice />
          <div
            className="dynamic-page-content rich-content"
            dangerouslySetInnerHTML={{ __html: contentHtml }}
          />
          <TwitterEmbedResize />
        </BlankLayout>
      )
    }

    return (
      <BasicLayout>
        <PreviewNotice />
        <div className="dynamic-page">
          <div
            className="dynamic-page-content rich-content"
            dangerouslySetInnerHTML={{ __html: contentHtml }}
          />
          <TwitterEmbedResize />
        </div>
      </BasicLayout>
    )
  }

  const page = await getPublishedPageByPath(pagePath)
  if (!page) {
    return redirectOrNotFound(pathname)
  }

  const contentHtml = applyRichTextPipeline(page.contentHtml)

  // blank 模板：不包含 Nav/Footer，但仍需 BlankLayout 注入主题 CSS 与 custom body HTML
  if (page.template === 'blank') {
    return (
      <BlankLayout>
        <div
          className="dynamic-page-content rich-content"
          dangerouslySetInnerHTML={{ __html: contentHtml }}
        />
        <TwitterEmbedResize />
      </BlankLayout>
    )
  }

  // default 模板：包含 BasicLayout
  return (
    <BasicLayout>
      <div className="dynamic-page">
        <div
          className="dynamic-page-content rich-content"
          dangerouslySetInnerHTML={{ __html: contentHtml }}
        />
        <TwitterEmbedResize />
      </div>
    </BasicLayout>
  )
}
