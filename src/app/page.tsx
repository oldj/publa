import PostListPage from '@/components/post-list-page'
import BasicLayout from '@/layouts/basic'
import contentSummary from '@/lib/contentSummary'
import { getFrontendPosts } from '@/server/services/posts-frontend'
import { IItemPage, IPost } from 'typings'

export default async function Page({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>
}) {
  const data = await getData(await searchParams)
  return <BasicLayout>{data.posts_page && <PostListPage data={data.posts_page} />}</BasicLayout>
}

interface IPostData {
  posts_page: IItemPage<IPost> | null
}

async function getData(searchParams: {
  [key: string]: string | string[] | undefined
}): Promise<IPostData> {
  const page = searchParams.page || '1'
  let postsPage = await getFrontendPosts({ page: Number(page) })

  if (postsPage) {
    postsPage.items = postsPage.items.map((item: IPost) => {
      item.html = contentSummary(item.html)
      item.comments = []
      return item
    })
  }

  return {
    posts_page: postsPage,
  }
}
