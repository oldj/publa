'use client'

import { RefObject, useEffect } from 'react'

// 跳过这些标签内的文本节点
const SKIP_TAGS = new Set(['script', 'style', 'code', 'pre', 'textarea'])

/**
 * 使用 CSS Custom Highlight API 在指定容器内高亮关键词。
 * 不支持该 API 的浏览器静默降级，无副作用。
 */
export default function useSearchHighlight(
  containers: RefObject<HTMLElement | null>[],
  keywords: string[],
) {
  useEffect(() => {
    if (!keywords.length) return
    if (typeof window === 'undefined') return
    if (!('Highlight' in window) || !CSS.highlights) return

    // 延迟一帧，确保 hljs / KaTeX 等后处理完成
    const raf = requestAnimationFrame(() => {
      const ranges: Range[] = []

      for (const ref of containers) {
        const root = ref.current
        if (!root) continue

        const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, {
          acceptNode(node) {
            let el = node.parentElement
            while (el && el !== root) {
              if (SKIP_TAGS.has(el.tagName.toLowerCase())) {
                return NodeFilter.FILTER_REJECT
              }
              el = el.parentElement
            }
            return NodeFilter.FILTER_ACCEPT
          },
        })

        while (walker.nextNode()) {
          const textNode = walker.currentNode as Text
          const text = textNode.textContent ?? ''
          const lower = text.toLowerCase()

          for (const kw of keywords) {
            const kwLower = kw.toLowerCase()
            let pos = 0
            while ((pos = lower.indexOf(kwLower, pos)) !== -1) {
              const range = new Range()
              range.setStart(textNode, pos)
              range.setEnd(textNode, pos + kw.length)
              ranges.push(range)
              pos += kw.length
            }
          }
        }
      }

      if (ranges.length > 0) {
        const highlight = new Highlight(...ranges)
        CSS.highlights.set('search-highlight', highlight)
      }
    })

    return () => {
      cancelAnimationFrame(raf)
      CSS.highlights?.delete('search-highlight')
    }
  }, [containers, keywords])
}
