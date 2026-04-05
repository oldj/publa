import { db } from '@/server/db'
import { insertOne, maybeFirst, updateOne } from '@/server/db/query'
import { redirectRules } from '@/server/db/schema'
import { redirectType as redirectTypeValues } from '@/server/db/schema/shared'
import { asc, eq } from 'drizzle-orm'

export type RedirectType = (typeof redirectTypeValues)[number]

export interface RedirectRule {
  id: number
  order: number
  pathRegex: string
  redirectTo: string
  redirectType: RedirectType
  memo: string | null
}

export interface RedirectRuleInput {
  pathRegex: string
  redirectTo: string
  redirectType: RedirectType
  memo?: string | null
}

export interface RedirectMatchResult {
  destination: string
  redirectType: RedirectType
  permanent: boolean
  ruleId: number
}

type RedirectRuleRow = typeof redirectRules.$inferSelect

const REDIRECT_TYPE_SET = new Set<RedirectType>(redirectTypeValues)

export class RedirectRuleValidationError extends Error {
  code:
    | 'INVALID_PATH_REGEX'
    | 'INVALID_REDIRECT_TO'
    | 'INVALID_REDIRECT_TYPE'
    | 'INVALID_REORDER_IDS'

  constructor(code: RedirectRuleValidationError['code'], message: string) {
    super(message)
    this.name = 'RedirectRuleValidationError'
    this.code = code
  }
}

function mapRedirectRule(row: RedirectRuleRow): RedirectRule {
  return {
    id: row.id,
    order: row.sortOrder,
    pathRegex: row.pathRegex,
    redirectTo: row.redirectTo,
    redirectType: row.redirectType,
    memo: row.memo,
  }
}

function normalizePathRegex(value?: string | null): string {
  return value?.trim() || ''
}

function normalizeRedirectTo(value?: string | null): string {
  return value?.trim() || ''
}

function normalizeMemo(value?: string | null): string | null {
  const memo = value?.trim()
  return memo ? memo : null
}

function assertValidPathRegex(value: string) {
  if (!value) {
    throw new RedirectRuleValidationError('INVALID_PATH_REGEX', 'Invalid redirect rule regex')
  }

  try {
    new RegExp(value)
  } catch {
    throw new RedirectRuleValidationError('INVALID_PATH_REGEX', 'Invalid redirect rule regex')
  }
}

function normalizeExternalUrl(input: string): string | null {
  try {
    const url = new URL(input)
    if (url.protocol !== 'http:' && url.protocol !== 'https:') {
      return null
    }
    return url.toString()
  } catch {
    return null
  }
}

function normalizeRedirectTarget(value: string): string {
  if (!value) {
    throw new RedirectRuleValidationError('INVALID_REDIRECT_TO', 'Invalid redirect destination')
  }

  if (value.startsWith('/')) {
    if (value.startsWith('//')) {
      throw new RedirectRuleValidationError('INVALID_REDIRECT_TO', 'Invalid redirect destination')
    }
    return value
  }

  const externalUrl = normalizeExternalUrl(value)
  if (!externalUrl) {
    throw new RedirectRuleValidationError('INVALID_REDIRECT_TO', 'Invalid redirect destination')
  }

  return externalUrl
}

function normalizeRedirectType(value?: string | null): RedirectType {
  const nextValue = (value?.trim() || '301') as RedirectType
  if (!REDIRECT_TYPE_SET.has(nextValue)) {
    throw new RedirectRuleValidationError('INVALID_REDIRECT_TYPE', 'Invalid redirect type')
  }
  return nextValue
}

export function validateRedirectRuleInput(input: RedirectRuleInput): RedirectRuleInput {
  const pathRegex = normalizePathRegex(input.pathRegex)
  const redirectTo = normalizeRedirectTo(input.redirectTo)
  const redirectType = normalizeRedirectType(input.redirectType)
  const memo = normalizeMemo(input.memo)

  assertValidPathRegex(pathRegex)

  return {
    pathRegex,
    redirectTo: normalizeRedirectTarget(redirectTo),
    redirectType,
    memo,
  }
}

export function normalizeRedirectPathname(input: string): string {
  const raw = input.trim()
  const [pathname] = raw.split(/[?#]/, 1)
  if (!pathname) return '/'
  if (pathname.startsWith('/')) return pathname
  return `/${pathname}`
}

function applyCaptureGroups(template: string, match: RegExpMatchArray): string {
  return template.replace(/\$(\d)/g, (_full, indexText: string) => {
    const index = Number(indexText)
    return match[index] ?? ''
  })
}

function resolveRedirectDestination(template: string, match: RegExpMatchArray): string | null {
  const destination = applyCaptureGroups(template, match)

  try {
    return normalizeRedirectTarget(destination)
  } catch (caughtError) {
    if (caughtError instanceof RedirectRuleValidationError) {
      return null
    }

    throw caughtError
  }
}

function isPermanentRedirect(type: RedirectType): boolean {
  return type === '301' || type === '308'
}

async function compactRedirectRuleOrder() {
  const rows = await db
    .select({
      id: redirectRules.id,
    })
    .from(redirectRules)
    .orderBy(asc(redirectRules.sortOrder), asc(redirectRules.id))

  for (const [index, row] of rows.entries()) {
    await db
      .update(redirectRules)
      .set({ sortOrder: index + 1 })
      .where(eq(redirectRules.id, row.id))
  }
}

export async function listRedirectRules(): Promise<RedirectRule[]> {
  const rows = await db
    .select()
    .from(redirectRules)
    .orderBy(asc(redirectRules.sortOrder), asc(redirectRules.id))

  return rows.map(mapRedirectRule)
}

export async function getRedirectRuleById(id: number): Promise<RedirectRule | null> {
  const row = await maybeFirst(
    db.select().from(redirectRules).where(eq(redirectRules.id, id)).limit(1),
  )
  return row ? mapRedirectRule(row) : null
}

export async function createRedirectRule(input: RedirectRuleInput): Promise<RedirectRule> {
  const data = validateRedirectRuleInput(input)
  const existingRules = await db.select({ id: redirectRules.id }).from(redirectRules)

  const row = await insertOne(
    db
      .insert(redirectRules)
      .values({
        sortOrder: existingRules.length + 1,
        pathRegex: data.pathRegex,
        redirectTo: data.redirectTo,
        redirectType: data.redirectType,
        memo: data.memo ?? null,
      })
      .returning(),
  )

  return mapRedirectRule(row)
}

export async function updateRedirectRule(
  id: number,
  input: RedirectRuleInput,
): Promise<RedirectRule | null> {
  const data = validateRedirectRuleInput(input)
  const row = await updateOne(
    db
      .update(redirectRules)
      .set({
        pathRegex: data.pathRegex,
        redirectTo: data.redirectTo,
        redirectType: data.redirectType,
        memo: data.memo ?? null,
      })
      .where(eq(redirectRules.id, id))
      .returning(),
  )

  return row ? mapRedirectRule(row) : null
}

export async function deleteRedirectRule(id: number) {
  await db.delete(redirectRules).where(eq(redirectRules.id, id))
  await compactRedirectRuleOrder()
  return { success: true }
}

export async function reorderRedirectRules(ids: number[]) {
  const normalizedIds = ids.map((id) => Number(id)).filter((id) => Number.isInteger(id) && id > 0)

  const rows = await db
    .select({ id: redirectRules.id })
    .from(redirectRules)
    .orderBy(asc(redirectRules.sortOrder), asc(redirectRules.id))

  const existingIds = rows.map((row) => row.id)
  if (
    normalizedIds.length !== existingIds.length ||
    new Set(normalizedIds).size !== normalizedIds.length ||
    normalizedIds.some((id) => !existingIds.includes(id))
  ) {
    throw new RedirectRuleValidationError('INVALID_REORDER_IDS', 'Invalid redirect reorder ids')
  }

  for (const [index, id] of normalizedIds.entries()) {
    await db
      .update(redirectRules)
      .set({ sortOrder: index + 1 })
      .where(eq(redirectRules.id, id))
  }

  return { success: true }
}

export async function matchRedirectRule(pathname: string): Promise<RedirectMatchResult | null> {
  const normalizedPathname = normalizeRedirectPathname(pathname)
  const rules = await listRedirectRules()

  for (const rule of rules) {
    let regex: RegExp

    try {
      regex = new RegExp(rule.pathRegex)
    } catch {
      continue
    }

    const match = normalizedPathname.match(regex)
    if (!match) continue

    const destination = resolveRedirectDestination(rule.redirectTo, match)
    if (!destination || destination === normalizedPathname) {
      continue
    }

    return {
      destination,
      redirectType: rule.redirectType,
      permanent: isPermanentRedirect(rule.redirectType),
      ruleId: rule.id,
    }
  }

  return null
}
