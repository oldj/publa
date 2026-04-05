/**
 * @author: oldj
 * @homepage: https://oldj.net
 */

'use client'

import Link from 'next/link'
import React, { useState } from 'react'
import { ICategory, ITag } from 'typings'
import styles from './footer.module.scss'

interface IProps {
  categories: ICategory[]
  tags: ITag[]
  footerCopyright?: string
}

export default function footer(props: IProps) {
  let { categories, tags, footerCopyright } = props
  const [kw, setKw] = useState('')

  const onSearch = () => {
    const hostname = window.location.hostname
    // 提取根域名：去掉 www 等子域名前缀，保留主域名部分
    const parts = hostname.split('.')
    const rootDomain = parts.length > 2
      ? parts.slice(-2).join('.').match(/\.(com|net|org|edu|gov|co)\.\w+$/)
        ? parts.slice(-3).join('.')
        : parts.slice(-2).join('.')
      : hostname
    const q = `site:${rootDomain} ${kw}`
    window.open(`https://www.google.com/search?q=${encodeURIComponent(q)}`)
  }

  return (
    <footer className={styles.root}>
      <div className={styles.content}>
        <div className={styles.block}>
          <h3>分类</h3>
          <ul className={styles.categories}>
            {categories.map((i) => (
              <li key={i.id}>
                <Link href={`/posts/list?category=${encodeURIComponent(i.name)}`}>
                  <span>{i.name}</span> <span className={styles.num}>({i.count})</span>
                </Link>
              </li>
            ))}
          </ul>

          <div className={styles.search}>
            <input
              placeholder="Search in Google"
              // allowClear
              onChange={(e) => setKw(e.target.value)}
              onKeyDown={(e) => {
                if (e.code === 'Enter') {
                  onSearch()
                }
              }}
            />
            <button onClick={() => onSearch()}>搜索</button>
          </div>

          <div className={styles.rss}>
            <a href="/feed" target="_blank">
              可通过 <strong>RSS</strong> 订阅本站
            </a>
          </div>
        </div>

        <div className={styles.block}>
          <h3>标签</h3>
          <div className={styles.tags}>
            {tags.map((i) => (
              <Link href={`/posts/list?tag=${encodeURIComponent(i.name)}`} key={i.id}>
                {i.name} <span className={styles.num}>({i.count})</span>
              </Link>
            ))}
          </div>
        </div>
      </div>

      {footerCopyright && (
        <div className={styles.copyright} dangerouslySetInnerHTML={{ __html: footerCopyright }} />
      )}
    </footer>
  )
}
