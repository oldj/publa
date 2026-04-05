/**
 * @author: oldj
 * @homepage: https://oldj.net
 */

'use client'

import { IconChevronRight } from '@tabler/icons-react'
import clsx from 'clsx'
import dayjs from 'dayjs'
import lodash from 'lodash'
import Link from 'next/link'
import { usePathname, useRouter, useSearchParams } from 'next/navigation'
import qs from 'qs'
import { Suspense } from 'react'
import PageLoading from 'src/components/page-loading'
import { IPost, IItemPage } from 'typings'
import styles from './post-list-page.module.scss'

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
      className={styles.post}
      onClick={async () => {
        // location.href = post.url
        await router.push(post.url)
      }}
    >
      <h2 className={styles.post_title}>
        <Link href={post.url}>{post.title}</Link>
      </h2>
      <div className={clsx(styles.pub_time, styles.info)}>{pubTime}</div>
      <div className={styles.summary}>{post.html}</div>
      <Link href={post.url} className={styles.read_more}>
        <span>阅读全文</span>
        <span className={styles.icon}>
          <IconChevronRight size={16} />
        </span>
      </Link>
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
    <div className={styles.pager}>
      <div className={styles.label}>页码：</div>
      <div className={styles.pagination}>{pages}</div>
    </div>
  )
}

const PostListPage = (props: Props) => {
  const { data } = props

  if (!data) {
    return <PageLoading />
  }

  if (data.itemCount === 0) {
    return <div className={styles.norecord}>没有记录</div>
  }

  return (
    <div className={styles.root}>
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
