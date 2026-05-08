/**
 */

import { isAnyPartOfElementInViewport } from '@/lib/element'
import { IconMenuDeep } from '@tabler/icons-react'
import clsx from 'clsx'
import { useTranslations } from 'next-intl'
import React, { useEffect, useState } from 'react'
import { IHeader } from 'src/lib/getHeadersFromHTML'

interface IProps {
  headers: IHeader[]
  className?: string
}

const TOC = React.forwardRef<HTMLDivElement, IProps>((props, ref) => {
  const { headers, className } = props
  const t = useTranslations('frontend.toc')
  const [currentNumber, setCurrentNumber] = useState<string | null>(null)

  useEffect(() => {
    const onScroll = () => {
      //
      for (const h of headers) {
        const { number } = h
        const el = document.querySelector(`[data-toc-id="${number}"]`)
        if (el && isAnyPartOfElementInViewport(el)) {
          setCurrentNumber(number)
          break
        }
      }
    }

    window.addEventListener('scroll', onScroll)

    return () => {
      window.removeEventListener('scroll', onScroll)
    }
  }, [])

  if (headers.length === 0) {
    return null
  }

  return (
    <div className={clsx('toc', className)} ref={ref}>
      <div>
        <div className="toc-header">
          <IconMenuDeep size={16} />
          <span>{t('title')}</span>
        </div>
        {headers.map((header, index) => {
          const { level, number, title } = header

          return (
            <div
              key={index}
              className={clsx('toc-item', `toc-h${level}`)}
              data-current={number === currentNumber}
            >
              <a href={`#${number || index + 1}-${title}`}>
                {/* {number && <span className="toc-number">{number}&nbsp;</span>} */}
                <span className="toc-title">{title}</span>
              </a>
            </div>
          )
        })}
      </div>
    </div>
  )
})

export default TOC
