/**
 * 从 HTML 内容中提取纯文本摘要。
 * 传入 keywords 时，优先截取包含关键词的片段。
 */

export default (content: string, maxLength = 100, keywords?: string[]): string => {
  if (!content) return ''

  content = content
    .replace(/<[^>]*>/g, '')
    .replace(/\s{2,}/g, ' ')
    .replace(/^\s+|\s+$/g, '')

  const chars = Array.from(content)

  if (chars.length <= maxLength) return content

  // 有关键词时，优先截取关键词附近的片段
  if (keywords?.length) {
    const lowerChars = chars.map((c) => c.toLowerCase())

    for (const kw of keywords) {
      const kwChars = Array.from(kw.toLowerCase())
      // 在码点数组中查找关键词位置
      let idx = -1
      for (let i = 0; i <= lowerChars.length - kwChars.length; i++) {
        if (kwChars.every((c, j) => lowerChars[i + j] === c)) {
          idx = i
          break
        }
      }
      if (idx < 0) continue

      // 以关键词为中心，向两边扩展
      const half = Math.floor((maxLength - kwChars.length) / 2)
      let start = Math.max(0, idx - half)
      let end = Math.min(chars.length, start + maxLength)
      if (end - start < maxLength) {
        start = Math.max(0, end - maxLength)
      }

      const slice = chars.slice(start, end).join('')
      const prefix = start > 0 ? '...' : ''
      const suffix = end < chars.length ? '...' : ''
      return prefix + slice + suffix
    }
  }

  return chars.slice(0, maxLength).join('') + '...'
}
