import { parseDocument } from 'htmlparser2'
import render from 'dom-serializer'
import { Element, Text, type ChildNode } from 'domhandler'
import katex from 'katex'

/** 不应在其内识别公式分隔符的容器（保留代码示例等原文） */
const SKIP_TAGS = new Set(['pre', 'code', 'script', 'style', 'kbd', 'samp', 'tt'])

/** 匹配 \(...\) 与 \[...\] 两种 markdown-it-mathjax 输出的分隔符 */
const DELIMITER_RE = /\\\(([\s\S]+?)\\\)|\\\[([\s\S]+?)\\\]/g

function renderLatex(latex: string, displayMode: boolean): string {
  return katex.renderToString(latex, {
    displayMode,
    throwOnError: false,
    output: 'html',
  })
}

/** 节点是否已含 KaTeX 渲染产物（用于幂等判断） */
function hasRenderedKatex(node: Element): boolean {
  return node.children.some((child) => {
    if (!(child instanceof Element)) return false
    const cls = child.attribs?.class
    return typeof cls === 'string' && cls.includes('katex')
  })
}

/** 把 HTML 字符串解析为子节点，替换 host 的 children，并修正 parentNode */
function setChildrenFromHtml(host: Element, html: string): void {
  const sub = parseDocument(html)
  for (const child of sub.children) {
    child.parentNode = host
  }
  host.children = sub.children
}

/** 把 KaTeX 渲染产物 HTML 解析为节点数组（用于插入到父节点 children） */
function parseHtmlToNodes(html: string, parent: Element | null): ChildNode[] {
  const sub = parseDocument(html)
  for (const child of sub.children) {
    child.parentNode = parent
  }
  return sub.children
}

/**
 * 扫描文本节点中的 \(..\) 与 \[..\] 分隔符并替换为 KaTeX 渲染产物。
 * 返回新的混合节点数组；若文本中无分隔符，返回 null。
 */
function splitTextByDelimiters(text: string, parent: Element | null): ChildNode[] | null {
  DELIMITER_RE.lastIndex = 0
  const segments: ChildNode[] = []
  let lastIndex = 0
  let matched = false
  let m: RegExpExecArray | null

  while ((m = DELIMITER_RE.exec(text)) !== null) {
    matched = true
    if (m.index > lastIndex) {
      const before = new Text(text.slice(lastIndex, m.index))
      before.parentNode = parent
      segments.push(before)
    }
    const isBlock = m[2] !== undefined
    const latex = (isBlock ? m[2] : m[1]).trim()
    const rendered = renderLatex(latex, isBlock)
    for (const node of parseHtmlToNodes(rendered, parent)) {
      segments.push(node)
    }
    lastIndex = m.index + m[0].length
  }

  if (!matched) return null

  if (lastIndex < text.length) {
    const tail = new Text(text.slice(lastIndex))
    tail.parentNode = parent
    segments.push(tail)
  }
  return segments
}

/**
 * 服务端渲染 HTML 中的数学公式：
 * - TipTap 节点：`<span data-type="inline-math" data-latex>` 与 `<div data-type="block-math" data-latex>`
 *   把 KaTeX 渲染产物注入节点 children；保留外层属性以便幂等检查与编辑器还原。
 * - Markdown 分隔符：文本节点中的 `\(...\)` 行内、`\[...\]` 块级。
 *   切分文本节点，把分隔符段落替换为 KaTeX 渲染产物。
 *
 * 跳过 <pre>/<code>/<script> 等容器内的分隔符（保留代码示例原文）。
 * 已含 .katex 子节点的 TipTap 节点视为已渲染，跳过。
 */
export default function wrapBlockMath(html: string): string {
  if (!html) return html
  if (
    !html.includes('data-type="inline-math"') &&
    !html.includes('data-type="block-math"') &&
    !html.includes('\\(') &&
    !html.includes('\\[')
  ) {
    return html
  }

  const doc = parseDocument(html)
  let changed = false

  function walk(children: ChildNode[], parent: Element | null, inSkip: boolean): ChildNode[] {
    const out: ChildNode[] = []
    for (const node of children) {
      if (node instanceof Element) {
        const tag = node.tagName
        const dataType = node.attribs?.['data-type']

        if (tag === 'span' && dataType === 'inline-math') {
          const latex = node.attribs?.['data-latex']
          if (latex && !hasRenderedKatex(node)) {
            setChildrenFromHtml(node, renderLatex(latex, false))
            changed = true
          }
          out.push(node)
          continue
        }

        if (tag === 'div' && dataType === 'block-math') {
          const latex = node.attribs?.['data-latex']
          if (latex && !hasRenderedKatex(node)) {
            setChildrenFromHtml(node, renderLatex(latex, true))
            changed = true
          }
          out.push(node)
          continue
        }

        const skipChild = inSkip || SKIP_TAGS.has(tag)
        node.children = walk(node.children, node, skipChild)
        out.push(node)
        continue
      }

      if (node instanceof Text && !inSkip) {
        const split = splitTextByDelimiters(node.data, parent)
        if (split !== null) {
          for (const seg of split) out.push(seg)
          changed = true
          continue
        }
      }

      out.push(node)
    }
    return out
  }

  doc.children = walk(doc.children, null, false)

  return changed ? render(doc, { encodeEntities: 'utf8' }) : html
}
