import GoBackButton from '@/components/GoBackButton'
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
  return (
    <BlankLayout>
      <div className="not-found">
        <h1 className="not-found-title">404 - 页面没有找到</h1>
        <p className="not-found-desc">这个页面不存在或者已过期。</p>
        <div className="not-found-actions">
          <a href="/" className="not-found-btn">
            <IconHome size={18} />
            首页
          </a>
          <GoBackButton />
        </div>
      </div>
    </BlankLayout>
  )
}
