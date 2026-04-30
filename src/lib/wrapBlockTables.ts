import { parseDocument } from 'htmlparser2'
import render from 'dom-serializer'
import { Element } from 'domhandler'

const WRAPPER_CLASS = 'rich-table-wrapper'

/**
 * 将正文中的 <table> 包裹在 <div class="rich-table-wrapper"> 容器中，
 * 配合主题 CSS 的 overflow:auto 让宽表格在窄屏可横向滚动。
 *
 * 对已经被同名 wrapper 包裹的 table 跳过，保证幂等。
 */
export default function wrapBlockTables(html: string): string {
  if (!html) return html

  const doc = parseDocument(html)
  let changed = false

  function walk(children: typeof doc.children) {
    for (let i = 0; i < children.length; i++) {
      const node = children[i]
      if (!(node instanceof Element)) continue

      if (node.tagName === 'table') {
        const parent = node.parentNode as Element | null
        const alreadyWrapped =
          parent &&
          parent.tagName === 'div' &&
          (parent.attribs.class || '').split(/\s+/).includes(WRAPPER_CLASS)

        if (alreadyWrapped) {
          walk(node.children)
          continue
        }

        const wrapper = new Element('div', { class: WRAPPER_CLASS }, [node])
        node.parentNode = wrapper
        children[i] = wrapper
        wrapper.parentNode = parent
        changed = true
        walk(node.children)
      } else if (node.children) {
        walk(node.children)
      }
    }
  }

  walk(doc.children)

  return changed ? render(doc, { encodeEntities: 'utf8' }) : html
}
