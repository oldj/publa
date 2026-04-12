import PostListPage from '@/components/post-list-page'
import { getServerTranslator } from '@/i18n/server'
import BasicLayout from '@/layouts/basic'
import contentSummary from '@/lib/contentSummary'
import { getFrontendPosts } from '@/server/services/posts-frontend'
import { IconChevronLeft } from '@tabler/icons-react'
import { Metadata } from 'next'
import Link from 'next/link'
import { IItemPage, IPost } from 'typings'

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getServerTranslator('frontend.posts')
  return { title: t('listTitle') }
}

export default async function Page({
  searchParams,
}: {
  searchParams: Promise<{ page?: string; category?: string; tag?: string }>
}) {
  const { t } = await getServerTranslator('frontend')
  const { page, category, tag } = await searchParams
  const data = await getData({ page, category, tag })
  const { postsPage, filter } = data

  let filterBy: string = ''
  let filterKey: string = ''

  if (filter) {
    let { category, tag } = filter
    if (category) {
      filterBy = t('posts.categoryPrefix')
      filterKey = category
    } else if (tag) {
      filterBy = t('posts.tagPrefix')
      filterKey = tag
    }
  }

  let rTitle: React.ReactNode = t('posts.listTitle')
  if (filterBy) {
    rTitle = (
      <>
        <span className="posts-filter-by">{filterBy}</span>
        <span>{filterKey}</span>
      </>
    )
  }

  return (
    <BasicLayout>
      <div className="posts-filter">
        {filterBy ? (
          <div className="posts-filter-bar">
            <h1 className="page_title">{rTitle}</h1>
            <div className="posts-filter-back">
              <Link href="/posts/list">
                <IconChevronLeft size={16} />
                {t('taxonomy.backToAllPosts')}
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
