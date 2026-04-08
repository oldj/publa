import PostListPage from '@/components/post-list-page'
import BasicLayout from '@/layouts/basic'
import contentSummary from '@/lib/contentSummary'
import { redirectOrNotFound } from '@/server/lib/frontend-404'
import { getCategoryBySlug } from '@/server/services/categories'
import { getFrontendPosts } from '@/server/services/posts-frontend'
import { IconChevronLeft } from '@tabler/icons-react'
import { Metadata } from 'next'
import Link from 'next/link'
import type { IPost } from 'typings'

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>
}): Promise<Metadata> {
  const { slug } = await params
  const category = await getCategoryBySlug(slug)
  return {
    title: category ? `分类：${category.seoTitle || category.name}` : '分类不存在',
    description: category?.seoDescription || undefined,
  }
}

export default async function CategoryPage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>
  searchParams: Promise<{ page?: string }>
}) {
  const { slug } = await params
  const { page } = await searchParams
  const category = await getCategoryBySlug(slug)
  if (!category) {
    return redirectOrNotFound(`/category/${slug}`)
  }

  const posts = await getFrontendPosts({
    page: Number(page || 1),
    categoryId: category.id,
  })

  posts.items = posts.items.map((item: IPost) => {
    item.html = contentSummary(item.html)
    item.comments = []
    return item
  })

  return (
    <BasicLayout>
      <div style={{ maxWidth: 720, margin: '0 auto', padding: '20px 0' }}>
        <h1 style={{ fontSize: 24, marginBottom: 8 }}>
          <span style={{ color: '#888' }}>分类：</span>
          {category.name}
        </h1>
        <div style={{ marginBottom: 20 }}>
          <Link href="/posts/list" style={{ fontSize: 14, color: '#666' }}>
            <IconChevronLeft size={14} style={{ verticalAlign: 'middle' }} />
            返回所有文章列表
          </Link>
        </div>
        <PostListPage data={posts} />
      </div>
    </BasicLayout>
  )
}
