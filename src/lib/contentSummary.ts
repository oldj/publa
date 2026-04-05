/**
 * contentSummary.ts
 */

export default (content: string, max_length = 100): string => {
  if (!content) return ''

  content = content
    .replace(/<[^>]*>/g, '')
    .replace(/\s{2,}/g, ' ')
    .replace(/^\s+|\s+$/g, '')

  if (content.length > max_length) {
    content = Array.from(content).slice(0, max_length).join('') + '...'
  }

  return content
}
