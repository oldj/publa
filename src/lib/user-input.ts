export function normalizeUsername(value: string | null | undefined): string {
  return typeof value === 'string' ? value.trim() : ''
}

export function normalizePassword(value: string | null | undefined): string {
  return typeof value === 'string' ? value.trim() : ''
}

export function normalizeEmail(value: string | null | undefined): string | null {
  if (typeof value !== 'string') return null

  const normalized = value.trim()
  return normalized || null
}
