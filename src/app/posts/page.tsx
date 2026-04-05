import BasicLayout from '@/layouts/basic'
import { getFrontendArchive } from '@/server/services/posts-frontend'
import dayjs from 'dayjs'
import { Metadata } from 'next'
import Link from 'next/link'
import styles from './page.module.scss'

export const metadata: Metadata = {
  title: '文章列表',
}

interface IArchiveOfYear {
  year: number
  list: {
    title: string
    url: string
    pubTime: string
  }[]
}

export default async function Page() {
  const data = await getData()

  return (
    <BasicLayout>
      <div className={styles.root}>
        <h1 className={styles.page_title}>文章</h1>

        {data.archives.map((o) => {
          return (
            <div key={o.year} className={styles.year}>
              <h2>{o.year}</h2>
              <ul>
                {o.list.map((post, idx) => (
                  <li key={idx} className={styles.item}>
                    <span className={styles.date}>{dayjs(post.pubTime).format('MM/DD')}</span>
                    <Link href={post.url}>{post.title}</Link>
                  </li>
                ))}
              </ul>
            </div>
          )
        })}
      </div>
    </BasicLayout>
  )
}

interface IPostData {
  archives: IArchiveOfYear[]
}

async function getData(): Promise<IPostData> {
  const archives = await getFrontendArchive()

  return {
    archives,
  }
}
