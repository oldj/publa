/**
 */

import clsx from 'clsx'

interface IProps {
  className?: string
}

const Loading = (props: IProps) => {
  const { className } = props
  return <div className={clsx('loading', className)}>Loading...</div>
}

export default Loading
