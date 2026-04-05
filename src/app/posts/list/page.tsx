import PostListPage from '@/components/post-list-page'
import BasicLayout from '@/layouts/basic'
import contentSummary from '@/lib/contentSummary'
import { getFrontendPosts } from '@/server/services/posts-frontend'
import { IconChevronLeft } from '@tabler/icons-react'
import { Metadata } from 'next'
import Link from 'next/link'
import { IPost, IItemPage } from 'typings'
import styles from './page.module.scss'

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
  const { posts_page, filter } = data

  let filter_by: string = ''
  let filter_key: string = ''

  if (filter) {
    let { category, tag } = filter
    if (category) {
      filter_by = '分类'
      filter_key = category
    } else if (tag) {
      filter_by = '标签'
      filter_key = tag
    }
  }

  let r_title: React.ReactNode = '文章列表'
  if (filter_by) {
    // title = `${filter_by}：${filter_key}`
    r_title = (
      <>
        <span className={styles.filter_by}>{filter_by}：</span>
        <span>{filter_key}</span>
      </>
    )
  }

  return (
    <BasicLayout>
      <div className={styles.root}>
        {filter_by ? (
          <div className={styles.filter}>
            <h1 className={styles.page_title}>{r_title}</h1>
            <div className={styles.back}>
              <Link href="/posts/list">
                <IconChevronLeft size={16} />
                返回所有文章列表
              </Link>
            </div>
          </div>
        ) : null}

        {posts_page && <PostListPage data={posts_page} />}
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
  posts_page: IItemPage<IPost> | null
}

async function getData(params: {
  page?: number | string
  category?: string
  tag?: string
}): Promise<IData> {
  let posts_page = await getFrontendPosts({
    page: Number(params.page || 1),
    category: params.category,
    tag: params.tag,
  })

  if (posts_page) {
    posts_page.items = posts_page.items.map((item: IPost) => {
      item.html = contentSummary(item.html)
      item.comments = []
      return item
    })
  }

  return {
    posts_page,
    filter: {
      page: params.page,
      category: params.category,
      tag: params.tag,
    },
  }
}
