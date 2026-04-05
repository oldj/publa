/**
 * Button.tsx
 */

import clsx from 'clsx'
import React from 'react'
import styles from './Button.module.scss'

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
  const { className, children, type, htmlType, size, disabled, loading } = props

  return (
    <button
      className={clsx(
        styles.root,
        className,
        size === 'small' && styles.small,
        size === 'medium' && styles.medium,
        size === 'large' && styles.large,
        loading && styles.loading,
      )}
      type={htmlType}
      disabled={disabled}
    >
      {children}
    </button>
  )
}

export default Button
