/**
 * @author: oldj
 * @homepage: https://oldj.net
 */

'use client'

import { useTranslations } from 'next-intl'

const PageLoading = () => {
  const t = useTranslations('common')
  return <div className="page-loading">{t('loading')}</div>
}

export default PageLoading
