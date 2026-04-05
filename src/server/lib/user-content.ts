const HTML_ESCAPE_MAP: Record<string, string> = {
  '&': '&amp;',
  '<': '&lt;',
  '>': '&gt;',
  '"': '&quot;',
  "'": '&#39;',
}

export function escapeHtml(input: string): string {
  return input.replace(/[&<>"']/g, (char) => HTML_ESCAPE_MAP[char] || char)
}

export function renderUserTextToHtml(input: string): string {
  const normalized = input.replace(/\r\n?/g, '\n')
  return escapeHtml(normalized).replace(/\n/g, '<br />')
}

export function normalizeExternalUrl(input?: string | null): string | null {
  const value = input?.trim()
  if (!value) return null

  try {
    const url = new URL(value)
    if (url.protocol !== 'http:' && url.protocol !== 'https:') {
      return null
    }
    return url.toString()
  } catch {
    return null
  }
}
