import FeedbackForm from '@/components/feedback-form'
import BasicLayout from '@/layouts/basic'
import { Metadata } from 'next'
import styles from './page.module.scss'

export const metadata: Metadata = {
  title: '留言',
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
  return (
    <BasicLayout>
      <div className={styles.root}>
        <h1 className={styles.page_title}>留言</h1>
        <div>欢迎给我留言，你的留言不会被公开：</div>

        <div className={styles.form}>
          <FeedbackForm />
        </div>
      </div>
    </BasicLayout>
  )
}
