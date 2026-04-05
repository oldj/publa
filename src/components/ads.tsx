/**
 * ads
 * @author: oldj
 * @homepage: https://oldj.net
 */

import React, { useEffect } from 'react'
import LizhiItem from './lizhi_ad'

const GoogleAd = () => {
  useEffect(() => {
    // @ts-ignore
    ;(window['adsbygoogle'] = window['adsbygoogle'] || []).push({})
  }, [])

  return (
    <ins
      className="adsbygoogle"
      style={{ display: 'block' }}
      data-ad-client="ca-pub-5435478394717613"
      data-ad-slot="4884022790"
      data-ad-format="auto"
      data-full-width-responsive="true"
    />
  )
}

export const AdPostFooter = () => {
  // return r > 30 ? <GoogleAd /> : <LizhiItem />
  return <GoogleAd />
}
