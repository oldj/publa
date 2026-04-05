/**
 */

import clsx from 'clsx'
import React from 'react'
import styles from './Loading.module.scss'

interface IProps {
  className?: string
}

const Loading = (props: IProps) => {
  const { className } = props
  return <div className={clsx(styles.root, className)}>Loading...</div>
}

export default Loading
