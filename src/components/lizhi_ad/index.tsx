/**
 * index.tsx
 */

import clsx from 'clsx'
import Link from 'next/link'
import React, { useEffect, useState } from 'react'
import { IoRefresh } from 'react-icons/io5'
import { IAdItem, items } from './data'

interface IProps {}

const LizhiItem = (props: IProps) => {
  const [item, setItem] = useState<IAdItem | null>(null)

  const refresh = () => {
    const current_index = item ? items.indexOf(item) : -1

    let index = 0
    while (true) {
      index = Math.floor(Math.random() * items.length)
      if (index !== current_index) {
        break
      }
      if (items.length <= 1) {
        break
      }
    }

    setItem(items[index])
  }

  useEffect(() => {
    refresh()
  }, [])

  if (!item) {
    return null
  }

  return (
    <div className="lizhi-ad">
      <div className="lizhi-ad-top">
        <span className="lizhi-ad-help">推荐的软件</span>
        <button className="lizhi-ad-refresh" onClick={refresh}>
          <IoRefresh />
        </button>
      </div>
      <Link
        href={item.url}
        target="_blank"
        className={clsx('lizhi-ad-container', 'umami--click--lizhi-item')}
      >
        <div className="lizhi-ad-icon">
          <img src={item.icon} alt={item.title} />
        </div>
        <div>
          <div className="lizhi-ad-title">{item.title}</div>
          <div className="lizhi-ad-desc">{item.desc}</div>
        </div>
      </Link>
    </div>
  )
}

export default LizhiItem
