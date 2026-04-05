export type DatabaseFamily = 'sqlite' | 'postgres'

function normalizeFamily(value?: string): DatabaseFamily {
  const family = value?.trim().toLowerCase()

  if (!family || family === 'sqlite' || family === 'libsql' || family === 'turso') {
    return 'sqlite'
  }

  if (family === 'postgres' || family === 'postgresql' || family === 'pg') {
    return 'postgres'
  }

  throw new Error(`Unsupported DATABASE_FAMILY: ${value}`)
}

export function getDatabaseFamily(): DatabaseFamily {
  return normalizeFamily(process.env.DATABASE_FAMILY)
}
