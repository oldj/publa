import Post from '@/app/posts/[...slug]/components/Post'
import PreviewNotice from '@/components/PreviewNotice'
import BasicLayout from '@/layouts/basic'
import getHeadersFromHTML, { IHeader } from '@/lib/getHeadersFromHTML'
import { getCurrentUser } from '@/server/auth'
import { db } from '@/server/db'
import { maybeFirst } from '@/server/db/query'
import { contents, slugHistories } from '@/server/db/schema'
import { redirectOrNotFound } from '@/server/lib/frontend-404'
import { getFrontendPostBySlug } from '@/server/services/posts-frontend'
import { parsePreviewId, getPreviewPost } from '@/server/services/preview'
import { and, eq, isNull } from 'drizzle-orm'
import { notFound, redirect } from 'next/navigation'
import { IAccount, IPost } from 'typings'

interface IPostData {
  post?: IPost
  account?: IAccount
  html?: string
  headers?: IHeader[]
}

interface GetDataOptions {
  slug: string[]
  preview: boolean
  viewer: Awaited<ReturnType<typeof getCurrentUser>>
  incrementViewCount: boolean
}

function getSlugKey(slug: string[]): string {
  let slugKey = ''
  if (slug) {
    if (slug.length === 4) {
      slugKey = slug[3]
    } else if (slug.length === 1) {
      slugKey = slug[0]
    }
  }

  if (!slugKey) {
    notFound()
  }

  return slugKey
}

function isPreviewRequest(preview: string | string[] | undefined): boolean {
  return preview === '1'
}

async function getData({
  slug,
  preview,
  viewer,
  incrementViewCount,
}: GetDataOptions): Promise<IPostData> {
  const slugKey = getSlugKey(slug)

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
    incrementViewCount,
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

      await redirectOrNotFound(`/posts/${slug.join('/')}`)
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
  searchParams: Promise<{ preview?: string | string[] }>
}) => {
  const { slug } = await params
  const { preview: previewParam } = await searchParams

  const slugKey = getSlugKey(slug)
  const previewId = parsePreviewId(slugKey)
  // --preview-{id} 模式或 ?preview=1 参数都视为预览
  const preview = previewId !== null || isPreviewRequest(previewParam)
  const viewer = preview ? await getCurrentUser() : null

  if (preview && !viewer) {
    notFound()
  }

  const data = await getData({
    slug,
    preview,
    viewer,
    incrementViewCount: false,
  })

  const title = data.post?.title || ''

  return {
    title,
  }
}

export default async function Page({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string[] }>
  searchParams: Promise<{ preview?: string | string[] }>
}) {
  const [{ slug }, { preview: previewParam }, currentUser] = await Promise.all([
    params,
    searchParams,
    getCurrentUser(),
  ])
  const slugKey = getSlugKey(slug)
  const previewId = parsePreviewId(slugKey)
  const preview = previewId !== null || isPreviewRequest(previewParam)

  if (preview && !currentUser) {
    notFound()
  }

  const data = await getData({
    slug,
    preview,
    viewer: currentUser,
    incrementViewCount: !preview && !currentUser,
  })
  const account: IAccount | undefined = currentUser
    ? { username: currentUser.username, isStaff: true }
    : undefined

  return (
    <BasicLayout>
      {preview && <PreviewNotice />}
      <Post account={account} post={data.post} html={data.html} headers={data.headers} />
    </BasicLayout>
  )
}
