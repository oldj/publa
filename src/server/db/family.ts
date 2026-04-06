export type DatabaseFamily = 'sqlite' | 'postgres'

export function getDatabaseFamily(): DatabaseFamily {
  const url = process.env.DATABASE_URL?.trim().toLowerCase() || ''

  if (url.startsWith('postgres://') || url.startsWith('postgresql://')) {
    return 'postgres'
  }

  return 'sqlite'
}
