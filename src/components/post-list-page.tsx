/**
 * @author: oldj
 * @homepage: https://oldj.net
 */

'use client'

import { IconChevronRight } from '@tabler/icons-react'
import dayjs from 'dayjs'
import lodash from 'lodash'
import Link from 'next/link'
import { usePathname, useRouter, useSearchParams } from 'next/navigation'
import qs from 'qs'
import { Suspense } from 'react'
import PageLoading from 'src/components/page-loading'
import { IItemPage, IPost } from 'typings'

interface Props {
  data: IItemPage<IPost>
}

interface PageProps {
  page: number
  pageCount: number
  pageSize: number
  itemCount: number
}

const PostCard = (props: { post: IPost }) => {
  const { post } = props
  const router = useRouter()
  const pubTime = post.pubTime ? dayjs(post.pubTime).format('YYYY-MM-DD') : ''

  return (
    <div
      className={`post-list-item${post.coverImage ? ' has-cover' : ''}`}
      onClick={async () => {
        await router.push(post.url)
      }}
    >
      {post.coverImage && (
        <div className="post-list-cover">
          <img src={post.coverImage} alt={post.title} />
        </div>
      )}
      <div className="post-list-body">
        <h2 className="post-list-title">
          <Link href={post.url}>{post.title}</Link>
        </h2>
        <div className="post-list-time post-list-info">{pubTime}</div>
        <div className="post-list-summary">{post.html}</div>
        <Link href={post.url} className="post-list-read-more">
          <span>阅读全文</span>
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
      <div className="post-list-label">页码：</div>
      <div className="post-list-pagination">{pages}</div>
    </div>
  )
}

const PostListPage = (props: Props) => {
  const { data } = props

  if (!data) {
    return <PageLoading />
  }

  if (data.itemCount === 0) {
    return <div className="post-list-empty">没有记录</div>
  }

  return (
    <div className="post-list">
      {data.items.map((post, idx) => {
        return <PostCard post={post} key={idx} />
      })}

      <Suspense fallback={null}>
        <Pager {...lodash.pick(data, ['page', 'pageCount', 'pageSize', 'itemCount'])} />
      </Suspense>
    </div>
  )
}

export default PostListPage
