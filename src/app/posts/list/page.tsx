import PostListPage from '@/components/post-list-page'
import BasicLayout from '@/layouts/basic'
import contentSummary from '@/lib/contentSummary'
import { getFrontendPosts } from '@/server/services/posts-frontend'
import { IconChevronLeft } from '@tabler/icons-react'
import { Metadata } from 'next'
import Link from 'next/link'
import { IItemPage, IPost } from 'typings'

export const metadata: Metadata = {
  title: '文章列表',
}

export default async function Page({
  searchParams,
}: {
  searchParams: Promise<{ page?: string; category?: string; tag?: string }>
}) {
  const { page, category, tag } = await searchParams
  const data = await getData({ page, category, tag })
  const { postsPage, filter } = data

  let filterBy: string = ''
  let filterKey: string = ''

  if (filter) {
    let { category, tag } = filter
    if (category) {
      filterBy = '分类'
      filterKey = category
    } else if (tag) {
      filterBy = '标签'
      filterKey = tag
    }
  }

  let r_title: React.ReactNode = '文章列表'
  if (filterBy) {
    // title = `${filter_by}：${filter_key}`
    r_title = (
      <>
        <span className="posts-filter-by">{filterBy}：</span>
        <span>{filterKey}</span>
      </>
    )
  }

  return (
    <BasicLayout>
      <div className="posts-filter">
        {filterBy ? (
          <div className="posts-filter-bar">
            <h1 className="page_title">{r_title}</h1>
            <div className="posts-filter-back">
              <Link href="/posts/list">
                <IconChevronLeft size={16} />
                返回所有文章列表
              </Link>
            </div>
          </div>
        ) : null}

        {postsPage && <PostListPage data={postsPage} />}
      </div>
    </BasicLayout>
  )
}

interface IData {
  filter: {
    page?: number | string
    category?: string
    tag?: string
  }
  postsPage: IItemPage<IPost> | null
}

async function getData(params: {
  page?: number | string
  category?: string
  tag?: string
}): Promise<IData> {
  let postsPage = await getFrontendPosts({
    page: Number(params.page || 1),
    category: params.category,
    tag: params.tag,
  })

  if (postsPage) {
    postsPage.items = postsPage.items.map((item: IPost) => {
      item.html = contentSummary(item.html)
      item.comments = []
      return item
    })
  }

  return {
    postsPage,
    filter: {
      page: params.page,
      category: params.category,
      tag: params.tag,
    },
  }
}
