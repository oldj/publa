import Post from '@/app/posts/[...slug]/components/Post'
import BasicLayout from '@/layouts/basic'
import getHeadersFromHTML, { IHeader } from '@/lib/getHeadersFromHTML'
import { getCurrentUser } from '@/server/auth'
import { db } from '@/server/db'
import { maybeFirst } from '@/server/db/query'
import { contents, slugHistories } from '@/server/db/schema'
import { redirectOrNotFound } from '@/server/lib/frontend-404'
import { getFrontendPostBySlug } from '@/server/services/posts-frontend'
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
  const preview = isPreviewRequest(previewParam)
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
  const preview = isPreviewRequest(previewParam)

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
      <Post account={account} post={data.post} html={data.html} headers={data.headers} />
    </BasicLayout>
  )
}
