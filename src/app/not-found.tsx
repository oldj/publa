import '@/styles/globals.scss'
import GoBackButton from '@/components/GoBackButton'
import { IconHome } from '@tabler/icons-react'

export const metadata = {
  title: '404 - Page Not Found',
}

export default async function NotFound() {
  return (
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
  )
}
