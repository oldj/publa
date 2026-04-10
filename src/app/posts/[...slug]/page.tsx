import Post from '@/app/posts/[...slug]/components/Post'
import PreviewNotice from '@/components/PreviewNotice'
import BasicLayout from '@/layouts/basic'
import { getAdminPath } from '@/lib/admin-path'
import getHeadersFromHTML, { IHeader } from '@/lib/getHeadersFromHTML'
import { getCurrentUser } from '@/server/auth'
import { db } from '@/server/db'
import { maybeFirst } from '@/server/db/query'
import { contents, slugHistories } from '@/server/db/schema'
import { redirectOrNotFound } from '@/server/lib/frontend-404'
import { getFrontendPostBySlug } from '@/server/services/posts-frontend'
import { getPreviewPost, parsePreviewId } from '@/server/services/preview'
import { getSetting } from '@/server/services/settings'
import { and, eq, isNull } from 'drizzle-orm'
import { notFound, permanentRedirect, redirect } from 'next/navigation'
import { IAccount, IPost } from 'typings'

interface IPostData {
  post?: IPost
  account?: IAccount
  html?: string
  headers?: IHeader[]
}

type PageSearchParams = Record<string, string | string[] | undefined>

interface GetDataOptions {
  slugKey: string
  pathname: string
  preview: boolean
  viewer: Awaited<ReturnType<typeof getCurrentUser>>
}

function buildSearchQuery(searchParams: PageSearchParams): string {
  const query = new URLSearchParams()

  for (const [key, value] of Object.entries(searchParams)) {
    if (value === undefined) continue

    if (Array.isArray(value)) {
      for (const item of value) {
        query.append(key, item)
      }
      continue
    }

    query.append(key, value)
  }

  const queryString = query.toString()
  return queryString ? `?${queryString}` : ''
}

function isDateAliasSlug(slug: string[]): boolean {
  if (slug.length !== 4) return false

  const [year, month, day] = slug
  return (
    /^\d{4}$/.test(year) && /^(0[1-9]|1[0-2])$/.test(month) && /^(0[1-9]|[12]\d|3[01])$/.test(day)
  )
}

// 统一处理文章路由：单段 slug 直接访问，日期型旧 permalink 永久跳到 canonical。
function resolvePostRoute(slug: string[], searchParams: PageSearchParams): string {
  if (slug.length === 1 && slug[0]) {
    return slug[0]
  }

  if (isDateAliasSlug(slug) && slug[3]) {
    permanentRedirect(`/posts/${slug[3]}${buildSearchQuery(searchParams)}`)
  }

  notFound()
}

function isPreviewRequest(preview: string | string[] | undefined): boolean {
  return preview === '1'
}

async function getData({ slugKey, pathname, preview, viewer }: GetDataOptions): Promise<IPostData> {
  // 处理 --preview-{id} 模式的预览请求
  const previewId = parsePreviewId(slugKey)
  if (previewId !== null) {
    if (!viewer) notFound()
    const post = await getPreviewPost(previewId)
    if (!post) notFound()
    const { html, headers } = getHeadersFromHTML(post.html || '')
    return { post, html, headers }
  }

  const post = await getFrontendPostBySlug(slugKey, {
    preview,
    viewer,
  })

  if (!post) {
    if (!preview) {
      // 检查 slug 历史记录，用于 301 重定向
      const found = await maybeFirst(
        db
          .select({ slug: contents.slug })
          .from(slugHistories)
          .innerJoin(contents, eq(contents.id, slugHistories.contentId))
          .where(and(eq(slugHistories.slug, slugKey), isNull(contents.deletedAt)))
          .limit(1),
      )
      if (found) {
        redirect(`/posts/${found.slug}`)
      }

      await redirectOrNotFound(pathname)
    }

    notFound()
  }

  const { html, headers } = getHeadersFromHTML(post.html || '')

  return {
    post,
    html,
    headers,
  }
}

export const generateMetadata = async ({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string[] }>
  searchParams: Promise<PageSearchParams>
}) => {
  const [{ slug }, resolvedSearchParams] = await Promise.all([params, searchParams])
  const { preview: previewParam } = resolvedSearchParams

  const slugKey = resolvePostRoute(slug, resolvedSearchParams)
  const previewId = parsePreviewId(slugKey)
  // --preview-{id} 模式或 ?preview=1 参数都视为预览
  const preview = previewId !== null || isPreviewRequest(previewParam)
  const viewer = preview ? await getCurrentUser() : null

  if (preview && !viewer) {
    notFound()
  }

  const data = await getData({
    slugKey,
    pathname: `/posts/${slugKey}`,
    preview,
    viewer,
  })

  return {
    title: data.post?.seoTitle || data.post?.title || '',
    description: data.post?.seoDescription || undefined,
  }
}

export default async function Page({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string[] }>
  searchParams: Promise<PageSearchParams>
}) {
  const [{ slug }, resolvedSearchParams, currentUser] = await Promise.all([
    params,
    searchParams,
    getCurrentUser(),
  ])
  const { preview: previewParam } = resolvedSearchParams
  const slugKey = resolvePostRoute(slug, resolvedSearchParams)
  const previewId = parsePreviewId(slugKey)
  const preview = previewId !== null || isPreviewRequest(previewParam)

  if (preview && !currentUser) {
    notFound()
  }

  const [data, afterPostHtml] = await Promise.all([
    getData({
      slugKey,
      pathname: `/posts/${slugKey}`,
      preview,
      viewer: currentUser,
    }),
    getSetting('customAfterPostHtml'),
  ])
  const account: IAccount | undefined = currentUser
    ? { username: currentUser.username, isStaff: true }
    : undefined

  return (
    <BasicLayout>
      {preview && <PreviewNotice />}
      <Post
        account={account}
        post={data.post}
        html={data.html}
        headers={data.headers}
        afterPostHtml={String(afterPostHtml ?? '') || undefined}
        adminPath={getAdminPath()}
      />
    </BasicLayout>
  )
}
