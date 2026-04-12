import GoBackButton from '@/components/GoBackButton'
import { getServerTranslator } from '@/i18n/server'
import BlankLayout from '@/layouts/blank'
import { getAllSettings, toStr } from '@/server/services/settings'
import { IconHome } from '@tabler/icons-react'
import type { Metadata } from 'next'

export async function generateMetadata(): Promise<Metadata> {
  let siteTitle = 'Publa'
  try {
    const s = await getAllSettings()
    siteTitle = toStr(s.siteTitle, 'Publa') || 'Publa'
  } catch {
    // 数据库尚未初始化时容忍缺省
  }
  return {
    title: `${siteTitle} - 404`,
  }
}

export default async function NotFound() {
  const { t } = await getServerTranslator('frontend.notFound')
  return (
    <BlankLayout>
      <div className="not-found">
        <h1 className="not-found-title">{t('title')}</h1>
        <p className="not-found-desc">{t('description')}</p>
        <div className="not-found-actions">
          <a href="/" className="not-found-btn">
            <IconHome size={18} />
            {t('home')}
          </a>
          <GoBackButton />
        </div>
      </div>
    </BlankLayout>
  )
}
