export async function maybeFirst<T>(query: Promise<T[]> | T[]): Promise<T | null> {
  const rows = await query
  return rows[0] ?? null
}

export async function first<T>(query: Promise<T[]> | T[]): Promise<T> {
  const row = await maybeFirst(query)
  if (!row) {
    throw new Error('Expected at least one row')
  }
  return row
}

export async function insertOne<T>(query: Promise<T[]> | T[]): Promise<T> {
  return first(query)
}

export async function updateOne<T>(query: Promise<T[]> | T[]): Promise<T | null> {
  return maybeFirst(query)
}
