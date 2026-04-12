import FeedbackForm from '@/components/feedback-form'
import { getServerTranslator } from '@/i18n/server'
import BasicLayout from '@/layouts/basic'
import { redirectOrNotFound } from '@/server/lib/frontend-404'
import { getSetting, toBool, toStr } from '@/server/services/settings'
import { Metadata } from 'next'

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getServerTranslator('frontend.guestbook')
  return { title: t('title') }
}

export default async function GuestbookPage() {
  const { t } = await getServerTranslator('frontend.guestbook')
  if (!toBool(await getSetting('enableGuestbook'))) await redirectOrNotFound('/guestbook')

  const guestbookWelcome = toStr(await getSetting('guestbookWelcome'))

  return (
    <BasicLayout>
      <div className="guestbook">
        <h1 className="guestbook-title">{t('title')}</h1>
        {guestbookWelcome && <p>{guestbookWelcome}</p>}

        <div className="guestbook-form">
          <FeedbackForm />
        </div>
      </div>
    </BasicLayout>
  )
}
