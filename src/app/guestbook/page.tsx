import FeedbackForm from '@/components/feedback-form'
import BasicLayout from '@/layouts/basic'
import { redirectOrNotFound } from '@/server/lib/frontend-404'
import { getSetting, toBool, toStr } from '@/server/services/settings'
import { Metadata } from 'next'

export const metadata: Metadata = {
  title: '留言板',
}

export default async function GuestbookPage() {
  if (!toBool(await getSetting('enableGuestbook'))) await redirectOrNotFound('/guestbook')

  const guestbookWelcome = toStr(await getSetting('guestbookWelcome'))

  return (
    <BasicLayout>
      <div className="guestbook">
        <h1 className="guestbook-title">留言板</h1>
        {guestbookWelcome && <p>{guestbookWelcome}</p>}

        <div className="guestbook-form">
          <FeedbackForm />
        </div>
      </div>
    </BasicLayout>
  )
}
