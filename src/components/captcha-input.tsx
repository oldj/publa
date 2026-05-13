/**
 * @author: oldj
 * @homepage: https://oldj.net
 */

import { useTranslations } from 'next-intl'
import React, { useImperativeHandle, useState } from 'react'

// 暴露给父组件的命令式方法集合
export interface CaptchaInputHandle {
  refresh: () => void
}

interface IProps {
  // react-hook-form register 返回的 ref 回调，需要挂到内部真正的 <input> 上
  inputRef?: (el: HTMLInputElement | null) => void

  [key: string]: any
}

const CaptchaInput = React.forwardRef<CaptchaInputHandle, IProps>((props, ref) => {
  const t = useTranslations('frontend.captcha')
  const [src, setSrc] = useState<string>('')

  const refresh = () => {
    setSrc(`/api/captcha?r=${Math.random()}`)
  }

  // 把刷新方法暴露给父组件。空 deps 即可——refresh 内部只调 setSrc，
  // setSrc 是 React 保证稳定的 setter，第一次 render 的引用始终可用。
  useImperativeHandle(ref, () => ({ refresh }), [])

  const { inputRef, ...inputProps } = props

  return (
    <div className="captcha-input">
      <div className="captcha-input-image" onClick={refresh}>
        {src ? <img src={src} alt={t('refreshAlt')} /> : null}
      </div>
      <div className="captcha-input-field">
        <input
          {...inputProps}
          maxLength={4}
          autoComplete="off"
          onFocus={() => {
            if (!src) {
              refresh()
            }
          }}
          ref={inputRef}
        />
      </div>
    </div>
  )
})

CaptchaInput.displayName = 'CaptchaInput'

export default CaptchaInput
