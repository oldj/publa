/**
 * 将自定义 head HTML 字符串解析为合法的 <head> 子元素渲染。
 * 支持 <script>、<meta>、<link>、<style> 四类标签。
 */

import { parseHeadHtml } from '@/lib/parse-head-html'

interface Props {
  html: string
}

export default function HeadElements({ html }: Props) {
  const elements = parseHeadHtml(html)

  if (elements.length === 0) return null

  return (
    <>
      {elements.map((el, i) => {
        switch (el.tag) {
          case 'meta':
            return <meta key={i} {...el.attrs} />
          case 'link':
            return <link key={i} {...el.attrs} />
          case 'script':
            if (el.content) {
              return (
                <script key={i} {...el.attrs} dangerouslySetInnerHTML={{ __html: el.content }} />
              )
            }
            return <script key={i} {...el.attrs} />
          case 'style':
            return (
              <style key={i} {...el.attrs} dangerouslySetInnerHTML={{ __html: el.content || '' }} />
            )
          default:
            return null
        }
      })}
    </>
  )
}
