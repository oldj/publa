/**
 * page-loading.tsx
 * @author: oldj
 * @homepage: https://oldj.net
 */

import React from 'react'
import styles from './page-loading.module.scss'

interface Props {}

const PageLoading = (props: Props) => {
  return <div className={styles.root}>loading...</div>
}

export default PageLoading
