/**
 * @author: oldj
 * @homepage: https://oldj.net
 */

'use client'

import Link from 'next/link'
import { useTranslations } from 'next-intl'
import { useRouter } from 'next/navigation'
import { useState } from 'react'
import { ICategory, ITag } from 'typings'

interface IProps {
  categories: ICategory[]
  tags: ITag[]
  footerCopyright?: string
  enableSearch?: boolean
}

export default function footer(props: IProps) {
  let { categories, tags, footerCopyright, enableSearch } = props
  const t = useTranslations('frontend.footer')
  const router = useRouter()
  const [kw, setKw] = useState('')

  const onSearch = () => {
    if (!kw.trim()) return
    router.push(`/search?q=${encodeURIComponent(kw.trim())}`)
  }

  return (
    <footer className="site-footer">
      <div className="site-footer-content">
        <div className="site-footer-block">
          <h3>{t('categories')}</h3>
          <ul className="site-footer-categories">
            {categories.map((i) => (
              <li key={i.id}>
                <Link href={`/posts/list?category=${encodeURIComponent(i.name)}`}>
                  <span>{i.name}</span> <span className="site-footer-num">({i.count})</span>
                </Link>
              </li>
            ))}
          </ul>

          {enableSearch && (
            <div className="site-footer-search">
              <input
                placeholder={t('searchPlaceholder')}
                // allowClear
                onChange={(e) => setKw(e.target.value)}
                onKeyDown={(e) => {
                  if (e.code === 'Enter') {
                    onSearch()
                  }
                }}
              />
              <button onClick={() => onSearch()}>{t('searchButton')}</button>
            </div>
          )}

          <div className="site-footer-rss">
            <a href="/feed" target="_blank">
              {t('rssPrefix')}
              <strong>RSS</strong>
              {t('rssSuffix')}
            </a>
          </div>
        </div>

        <div className="site-footer-block">
          <h3>{t('tags')}</h3>
          <div className="site-footer-tags">
            {tags.map((i) => (
              <Link href={`/posts/list?tag=${encodeURIComponent(i.name)}`} key={i.id}>
                {i.name} <span className="site-footer-num">({i.count})</span>
              </Link>
            ))}
          </div>
        </div>
      </div>

      {footerCopyright && (
        <div
          className="site-footer-copyright"
          dangerouslySetInnerHTML={{ __html: footerCopyright }}
        />
      )}
    </footer>
  )
}
