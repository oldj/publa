'use client'

import { EditorContent, type Editor } from '@tiptap/react'
import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { adaptEditorTheme } from './editor-theme'

type Layout = 'post' | 'page' | 'blank'

function copyEditorStyles(root: ShadowRoot) {
  const tiptap = document.querySelector('style[data-tiptap-style]')
  if (tiptap) root.append(tiptap.cloneNode(true))

  // 复用打包器生成的 KaTeX 样式和字体资源，避免把 Mantine 的全局排版引入正文。
  for (const sheet of document.styleSheets) {
    let rules: CSSRuleList
    try {
      rules = sheet.cssRules
    } catch (error) {
      // CDN 重定向和 CORS 都会影响读取权限，以浏览器对实际样式表的判断为准。
      if (error instanceof DOMException && error.name === 'SecurityError') continue
      throw error
    }
    for (const rule of rules) {
      if (rule instanceof CSSLayerBlockRule && rule.name === 'publa-editor-math') {
        const math = document.createElement('style')
        // 字体已在主文档注册；只复制排版规则，保留字体 URL 原来的解析位置。
        math.textContent = Array.from(rule.cssRules)
          .filter((child) => !(child instanceof CSSFontFaceRule))
          .map((child) => child.cssText)
          .join('\n')
        root.append(math)
      }
    }
  }
}

export default function ThemedEditorContent({
  editor,
  layout,
}: {
  editor: Editor
  layout: Layout
}) {
  const hostRef = useRef<HTMLDivElement>(null)
  const [body, setBody] = useState<HTMLElement | null>(null)
  const basic = layout !== 'blank'

  useLayoutEffect(() => {
    const host = hostRef.current!
    const root = host.shadowRoot ?? host.attachShadow({ mode: 'open' })
    const html = document.createElement('html')
    const body = document.createElement('body')
    html.lang = document.documentElement.lang
    html.dataset.editorDocument = ''
    html.dataset.editorLayout = ''
    body.dataset.role = 'body'
    body.dataset.editorLayout = ''
    html.append(body)
    root.append(html)
    copyEditorStyles(root)

    const controls = document.createElement('link')
    controls.rel = 'stylesheet'
    controls.href = '/styles/editor-content.css'
    root.append(controls)

    setBody(body)
    return () => root.replaceChildren()
  }, [])

  useEffect(() => {
    // 空白模板直接返回保存的 HTML；切换模板只替换样式，保留光标和撤销记录。
    if (!body || !basic) return
    const root = body.getRootNode() as ShadowRoot
    const fonts = document.createElement('style')
    document.head.append(fonts)
    const links = ['/themes/theme.css', '/themes/custom.css'].map((href) => {
      const link = document.createElement('link')
      link.rel = 'stylesheet'
      link.href = href
      return link
    })
    const sheets = links.map(
      (link) =>
        new Promise<CSSStyleSheet | null>((resolve) => {
          link.onload = () => resolve(link.sheet)
          link.onerror = () => resolve(null)
          root.append(link)
        }),
    )
    void Promise.all(sheets).then((loaded) => {
      if (!fonts.sheet) return
      adaptEditorTheme(
        loaded.filter((sheet) => sheet !== null),
        fonts.sheet,
      )
    })
    return () => {
      fonts.remove()
      links.forEach((link) => link.remove())
    }
  }, [basic, body])
  return (
    <div ref={hostRef} className="rich-editor-surface" data-role="rich-text-editor">
      {body &&
        createPortal(
          <div data-editor-layout="" className={basic ? 'basic-layout' : undefined}>
            <main data-editor-layout="" className={basic ? 'basic-layout-body' : undefined}>
              <EditorContent
                data-editor-layout=""
                className={basic ? (layout === 'post' ? 'post-detail' : 'dynamic-page') : undefined}
                editor={editor}
              />
            </main>
          </div>,
          body,
        )}
    </div>
  )
}
