import { parseDocument } from 'htmlparser2'
import render from 'dom-serializer'
import { Element } from 'domhandler'

/** 不需要包裹的父标签（img 已在容器内） */
const CONTAINER_TAGS = new Set([
  'p',
  'a',
  'figure',
  'picture',
  'td',
  'th',
  'li',
  'span',
  'button',
  'label',
])

/**
 * 将顶层块级 <img> 标签包裹在 <p class="post-detail-img"> 容器中，
 * 并将 data-align 属性传递到容器上以控制对齐。
 *
 * 仅包裹"块级"图片（不在 <p>、<a>、<figure> 等容器内的图片），
 * 已在容器内的行内图片不做处理。
 */
export default function wrapBlockImages(html: string): string {
  if (!html) return html

  const doc = parseDocument(html)
  let changed = false

  // 递归查找需要包裹的 img 节点
  function walk(children: typeof doc.children) {
    for (let i = 0; i < children.length; i++) {
      const node = children[i]
      if (!(node instanceof Element)) continue

      if (node.tagName === 'img') {
        // 检查父节点是否为容器标签
        const parent = node.parentNode as Element | null
        if (parent && CONTAINER_TAGS.has(parent.tagName)) continue

        // 包裹 img
        const align = node.attribs['data-align'] || ''
        const attrs: Record<string, string> = { class: 'post-detail-img' }
        if (align) attrs['data-align'] = align

        const wrapper = new Element('p', attrs, [node])
        node.parentNode = wrapper
        children[i] = wrapper
        wrapper.parentNode = parent
        changed = true
      } else if (node.children) {
        walk(node.children)
      }
    }
  }

  walk(doc.children)

  return changed ? render(doc, { encodeEntities: 'utf8' }) : html
}
