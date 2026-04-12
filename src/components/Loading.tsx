/**
 */

'use client'

import clsx from 'clsx'
import { useTranslations } from 'next-intl'

interface IProps {
  className?: string
}

const Loading = (props: IProps) => {
  const t = useTranslations('common')
  const { className } = props
  return <div className={clsx('loading', className)}>{t('loading')}</div>
}

export default Loading
