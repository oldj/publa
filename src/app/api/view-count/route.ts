import { db } from '@/server/db'
import { maybeFirst } from '@/server/db/query'
import { contents } from '@/server/db/schema'
import { jsonError, jsonSuccess } from '@/server/lib/api-response'
import { safeParseJson } from '@/server/lib/request'
import { and, eq, isNull, sql } from 'drizzle-orm'
import { NextRequest } from 'next/server'

/** 递增文章浏览数 */
export async function POST(request: NextRequest) {
  const { data, error } = await safeParseJson(request)
  if (error) return error

  const slug = data?.slug
  if (!slug || typeof slug !== 'string') {
    return jsonError({
      source: request,
      namespace: 'frontend.api.posts',
      key: 'slugRequired',
      code: 'VALIDATION_ERROR',
      status: 400,
    })
  }

  const row = await maybeFirst(
    db
      .select({ id: contents.id })
      .from(contents)
      .where(
        and(
          eq(contents.type, 'post'),
          eq(contents.slug, slug),
          eq(contents.status, 'published'),
          isNull(contents.deletedAt),
        ),
      )
      .limit(1),
  )

  if (!row) {
    return jsonError({
      source: request,
      namespace: 'frontend.api.posts',
      key: 'notFound',
      code: 'NOT_FOUND',
      status: 404,
    })
  }

  await db
    .update(contents)
    .set({ viewCount: sql`${contents.viewCount} + 1` })
    .where(eq(contents.id, row.id))

  return jsonSuccess()
}
