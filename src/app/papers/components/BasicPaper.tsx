'use client'

import renderMathInElement from 'katex/contrib/auto-render'
import 'katex/dist/katex.min.css'
import styles from './BasicPaper.module.scss'
import { useEffect } from 'react'

interface IProps {
  width: number
  height: number
  safeArea: [number, number, number, number]
  children: React.ReactNode
}

export default function BasicPaper({ width, height, safeArea, children }: IProps) {
  useEffect(() => {
    // katex
    renderMathInElement(document.body, {
      delimiters: [
        { left: '$$', right: '$$', display: true },
        { left: '$', right: '$', display: false },
        { left: '\\[', right: '\\]', display: true },
        { left: '\\(', right: '\\)', display: false },
      ],
    })
  }, [])

  return (
    <div
      className={styles.root}
      style={{
        width,
        height,
        padding: `${safeArea[0]}px ${safeArea[1]}px ${safeArea[2]}px ${safeArea[3]}px`,
      }}
    >
      <div className={styles.content}>{children}</div>
    </div>
  )
}
