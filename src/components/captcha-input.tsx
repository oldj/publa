/**
 * @author: oldj
 * @homepage: https://oldj.net
 */

import lodash from 'lodash'
import React, { useEffect, useState } from 'react'

interface IProps {
  setRefresh?: (refresh: () => void) => void

  [key: string]: any
}

const CaptchaInput = React.forwardRef<HTMLInputElement, IProps>((props, ref) => {
  const [src, setSrc] = useState<string>('')

  const refresh = () => {
    setSrc(`/api/captcha?r=${Math.random()}`)
  }

  useEffect(() => {
    if (typeof props.setRefresh === 'function') {
      props.setRefresh(() => refresh())
    }
  }, [])

  useEffect(() => {
    // refresh()
  }, [])

  return (
    <div className="captcha-input">
      <div className="captcha-input-image" onClick={() => refresh()}>
        {src ? <img src={src} alt="点击刷新" /> : null}
      </div>
      <div className="captcha-input-field">
        <input
          {...lodash.omit(props, ['setRefresh'])}
          maxLength={4}
          autoComplete="off"
          onFocus={() => {
            if (!src) {
              refresh()
            }
          }}
          ref={ref}
        />
      </div>
    </div>
  )
})

export default CaptchaInput
