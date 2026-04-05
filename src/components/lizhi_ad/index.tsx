/**
 * index.tsx
 */

import clsx from 'clsx'
import Link from 'next/link'
import React, { useEffect, useState } from 'react'
import { IoRefresh } from 'react-icons/io5'
import { IAdItem, items } from './data'
import styles from './index.module.scss'

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
    <div className={styles.root}>
      <div className={styles.top}>
        <span className={styles.help_text}>推荐的软件</span>
        <button className={styles.btn_refresh} onClick={refresh}>
          <IoRefresh />
        </button>
      </div>
      <Link
        href={item.url}
        target="_blank"
        className={clsx(styles.container, 'umami--click--lizhi-item')}
      >
        <div className={styles.icon}>
          <img src={item.icon} alt={item.title} />
        </div>
        <div className={styles.content}>
          <div className={styles.title}>{item.title}</div>
          <div className={styles.desc}>{item.desc}</div>
        </div>
      </Link>
    </div>
  )
}

export default LizhiItem
