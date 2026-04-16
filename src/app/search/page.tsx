import PostListPage from '@/components/post-list-page'
import SearchInput from '@/components/search-input'
import { getServerTranslator } from '@/i18n/server'
import BasicLayout from '@/layouts/basic'
import contentSummary from '@/lib/contentSummary'
import { searchFrontendPosts } from '@/server/services/posts-frontend'
import { Metadata } from 'next'
import { IPost } from 'typings'

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getServerTranslator('frontend.search')
  return { title: t('title') }
}

export default async function Page({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; page?: string }>
}) {
  const { t } = await getServerTranslator('frontend')
  const { q, page } = await searchParams
  const query = q?.trim() || ''

  let content: React.ReactNode

  if (query) {
    const postsPage = await searchFrontendPosts({
      query,
      page: Number(page || 1),
    })

    // 截取摘要，清除评论（与文章列表页一致）
    const keywords = query.split(/\s+/).filter(Boolean)
    postsPage.items = postsPage.items.map((item: IPost) => {
      item.html = contentSummary(item.html, 100, keywords)
      item.comments = []
      return item
    })

    content =
      postsPage.itemCount > 0 ? (
        <>
          <h1 className="page_title">{t('search.resultsTitle', { query })}</h1>
          <PostListPage data={postsPage} highlightQuery={query} />
        </>
      ) : (
        <>
          <h1 className="page_title">{t('search.resultsTitle', { query })}</h1>
          <div className="search-empty">{t('search.noResults', { query })}</div>
        </>
      )
  } else {
    content = <div className="search-prompt">{t('search.prompt')}</div>
  }

  return (
    <BasicLayout>
      <div className="search-page">
        <SearchInput defaultValue={query} />
        {content}
      </div>
    </BasicLayout>
  )
}
