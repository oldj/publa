/**
 * Input.tsx
 */

import React from 'react'

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
    <div className="w-input">
      <input
        type={type}
        className="w-input-field"
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
    <div className="w-input">
      <textarea className="w-input-field" rows={rows} maxLength={maxLength} />
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
    <div className="w-input">
      <input type="search" className="w-input-field" />
    </div>
  )
}

export default Input
