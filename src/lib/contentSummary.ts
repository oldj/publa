/**
 */

export default (content: string, maxLength = 100): string => {
  if (!content) return ''

  content = content
    .replace(/<[^>]*>/g, '')
    .replace(/\s{2,}/g, ' ')
    .replace(/^\s+|\s+$/g, '')

  if (content.length > maxLength) {
    content = Array.from(content).slice(0, maxLength).join('') + '...'
  }

  return content
}
