/**
 * Input.tsx
 */

import React from 'react'
import styles from './Input.module.scss'

interface CommonProps {
  placeholder?: string
  maxLength?: number
  onFocus?: (e: React.FocusEvent<HTMLInputElement>) => void
}

interface InputProps extends CommonProps {
  type?: string
  autoComplete?: 'off' | 'on'
}

const Input = (props: InputProps) => {
  const { type, maxLength, placeholder, autoComplete, onFocus } = props

  return (
    <div className={styles.root}>
      <input
        type={type}
        className={styles.input}
        maxLength={maxLength}
        placeholder={placeholder}
        autoComplete={autoComplete}
        onFocus={onFocus}
      />
    </div>
  )
}

interface TextAreaProps extends CommonProps {
  rows?: number
}

Input.TextArea = (props: TextAreaProps) => {
  const { rows, maxLength } = props

  return (
    <div className={styles.root}>
      <textarea className={styles.input} rows={rows} maxLength={maxLength} />
    </div>
  )
}

interface SearchProps extends CommonProps {
  onSearch?: (value: string) => void
  enterButton?: string
  size?: 'small' | 'medium' | 'large'
}

Input.Search = (props: SearchProps) => {
  return (
    <div className={styles.root}>
      <input type="search" className={styles.input} />
    </div>
  )
}

export default Input
