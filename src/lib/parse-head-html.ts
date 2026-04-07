/**
 * 解析自定义 head HTML 字符串，提取 <script>、<meta>、<link>、<style> 标签。
 * 返回结构化数据供 React 渲染为合法的 <head> 子元素，避免使用 <div> 包裹。
 */

export type HeadTag = 'script' | 'meta' | 'link' | 'style'

export interface ParsedHeadElement {
  tag: HeadTag
  attrs: Record<string, string | boolean>
  content?: string
}

// HTML 属性名 → React JSX 属性名
const ATTR_MAP: Record<string, string> = {
  charset: 'charSet',
  class: 'className',
  crossorigin: 'crossOrigin',
  'http-equiv': 'httpEquiv',
  nomodule: 'noModule',
  referrerpolicy: 'referrerPolicy',
}

/**
 * 解析 HTML 标签的属性字符串，返回 React 兼容的属性对象
 */
function parseAttrs(attrString: string): Record<string, string | boolean> {
  const attrs: Record<string, string | boolean> = {}
  // 匹配：key="value" | key='value' | key=value | key（布尔属性）
  const re = /([a-zA-Z_][\w\-.:]*)\s*(?:=\s*(?:"([^"]*)"|'([^']*)'|(\S+)))?/g
  let m: RegExpExecArray | null
  while ((m = re.exec(attrString)) !== null) {
    const rawName = m[1]
    const value = m[2] ?? m[3] ?? m[4]
    const name = ATTR_MAP[rawName.toLowerCase()] ?? rawName
    attrs[name] = value === undefined ? true : value
  }
  return attrs
}

/**
 * 从 HTML 字符串中提取 script / meta / link / style 标签
 */
export function parseHeadHtml(html: string): ParsedHeadElement[] {
  if (!html || !html.trim()) return []

  const elements: ParsedHeadElement[] = []

  // 匹配 <script ...>...</script> 或 <script ... />
  const scriptRe = /<script(\s[^>]*)?>[\s\S]*?<\/script>|<script(\s[^>]*)?\/>/gi
  for (const m of html.matchAll(scriptRe)) {
    const full = m[0]
    const attrStr = m[1] || m[2] || ''
    const contentMatch = full.match(/<script[^>]*>([\s\S]*?)<\/script>/i)
    elements.push({
      tag: 'script',
      attrs: parseAttrs(attrStr),
      content: contentMatch ? contentMatch[1] : undefined,
    })
  }

  // 匹配 <style ...>...</style>
  const styleRe = /<style(\s[^>]*)?>[\s\S]*?<\/style>/gi
  for (const m of html.matchAll(styleRe)) {
    const full = m[0]
    const attrStr = m[1] || ''
    const contentMatch = full.match(/<style[^>]*>([\s\S]*?)<\/style>/i)
    elements.push({
      tag: 'style',
      attrs: parseAttrs(attrStr),
      content: contentMatch ? contentMatch[1] : '',
    })
  }

  // 匹配 <meta ... /> 或 <meta ...>
  const metaRe = /<meta(\s[^>]*?)\/?>/gi
  for (const m of html.matchAll(metaRe)) {
    elements.push({
      tag: 'meta',
      attrs: parseAttrs(m[1] || ''),
    })
  }

  // 匹配 <link ... /> 或 <link ...>
  const linkRe = /<link(\s[^>]*?)\/?>/gi
  for (const m of html.matchAll(linkRe)) {
    elements.push({
      tag: 'link',
      attrs: parseAttrs(m[1] || ''),
    })
  }

  return elements
}
