/**
 * @author: oldj
 * @homepage: https://oldj.net
 */

'use client'

import PageLoading from '@/components/page-loading'
import useSearchHighlight from '@/hooks/useSearchHighlight'
import { IconChevronRight } from '@tabler/icons-react'
import dayjs from 'dayjs'
import lodash from 'lodash'
import { useTranslations } from 'next-intl'
import Link from 'next/link'
import { usePathname, useRouter, useSearchParams } from 'next/navigation'
import qs from 'qs'
import { Suspense, useMemo, useRef } from 'react'
import { IItemPage, IPost } from 'typings'

interface Props {
  data: IItemPage<IPost>
  highlightQuery?: string
}

interface PageProps {
  page: number
  pageCount: number
  pageSize: number
  itemCount: number
}

const PostCard = (props: { post: IPost; highlightQuery?: string }) => {
  const { post, highlightQuery } = props
  const t = useTranslations('frontend.posts.list')
  const router = useRouter()
  const pubTime = post.pubTime ? dayjs(post.pubTime).format('YYYY-MM-DD') : ''

  // 从搜索页跳转到详情页时，带上关键词参数
  const postUrl = highlightQuery ? `${post.url}?q=${encodeURIComponent(highlightQuery)}` : post.url

  return (
    <div
      className={`post-list-item${post.coverImage ? ' has-cover' : ''}`}
      onClick={async () => {
        await router.push(postUrl)
      }}
    >
      {post.coverImage && (
        <div className="post-list-cover">
          <img src={post.coverImage} alt={post.title} />
        </div>
      )}
      <div className="post-list-body">
        <h2 className="post-list-title">
          {post.pinned && <span className="post-list-pinned">{t('pinned')}</span>}
          <Link href={postUrl}>{post.title}</Link>
        </h2>
        <div className="post-list-time post-list-info">{pubTime}</div>
        <div className="post-list-summary">{post.html}</div>
        <Link href={postUrl} className="post-list-read-more">
          <span>{t('readMore')}</span>
          <span className="post-list-read-more-icon">
            <IconChevronRight size={16} />
          </span>
        </Link>
      </div>
    </div>
  )
}

const Pager = (props: PageProps) => {
  let { page, pageCount } = props
  const pathname = usePathname()
  const searchParams = useSearchParams()

  let pages = []
  for (let i = 1; i <= pageCount; i++) {
    let p = qs.stringify({ ...Object.fromEntries(searchParams), page: i })

    pages.push(
      i === page ? (
        <span key={i}>{i}</span>
      ) : (
        <Link key={i} href={`${pathname}?${p}`}>
          {i.toString()}
        </Link>
      ),
    )
  }

  return (
    <div className="post-list-pager">
      <div className="post-list-pagination">{pages}</div>
    </div>
  )
}

const PostListPage = (props: Props) => {
  const { data, highlightQuery } = props
  const t = useTranslations('frontend.posts.list')
  const listRef = useRef<HTMLDivElement>(null)
  const keywords = useMemo(
    () => (highlightQuery ? highlightQuery.split(/\s+/).filter(Boolean) : []),
    [highlightQuery],
  )
  const highlightContainers = useMemo(() => [listRef], [])

  useSearchHighlight(highlightContainers, keywords)

  if (!data) {
    return <PageLoading />
  }

  if (data.itemCount === 0) {
    return <div className="post-list-empty">{t('empty')}</div>
  }

  return (
    <div className="post-list" ref={listRef}>
      {data.items.map((post, idx) => {
        return <PostCard post={post} key={idx} highlightQuery={highlightQuery} />
      })}

      <Suspense fallback={null}>
        <Pager {...lodash.pick(data, ['page', 'pageCount', 'pageSize', 'itemCount'])} />
      </Suspense>
    </div>
  )
}

export default PostListPage
