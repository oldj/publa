import FeedbackForm from '@/components/feedback-form'
import BasicLayout from '@/layouts/basic'
import { redirectOrNotFound } from '@/server/lib/frontend-404'
import { getSetting } from '@/server/services/settings'
import { Metadata } from 'next'
import styles from './page.module.scss'

export const metadata: Metadata = {
  title: '留言板',
}

export default async function GuestbookPage() {
  const enableGuestbook = await getSetting('enableGuestbook')
  if (enableGuestbook === 'false') await redirectOrNotFound('/guestbook')

  const guestbookWelcome = await getSetting('guestbookWelcome')

  return (
    <BasicLayout>
      <div className={styles.root}>
        <h1 className={styles.page_title}>留言板</h1>
        {guestbookWelcome && <p>{guestbookWelcome}</p>}

        <div className={styles.form}>
          <FeedbackForm />
        </div>
      </div>
    </BasicLayout>
  )
}
