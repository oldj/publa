/**
 */

import clsx from 'clsx'
import React from 'react'

interface Props {
  children: React.ReactNode
  className?: string
  type?: 'primary'
  htmlType?: 'button' | 'submit' | 'reset'
  size?: 'small' | 'medium' | 'large'
  disabled?: boolean
  loading?: boolean
}

const Button = (props: Props) => {
  const { className, children, htmlType, disabled } = props

  return (
    <button className={clsx(className)} type={htmlType} disabled={disabled}>
      {children}
    </button>
  )
}

export default Button
