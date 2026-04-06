/**
 */

import clsx from 'clsx'
import React from 'react'

interface IProps {
  className?: string
}

const Loading = (props: IProps) => {
  const { className } = props
  return <div className={clsx('loading', className)}>Loading...</div>
}

export default Loading
