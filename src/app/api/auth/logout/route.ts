import { clearAuthCookie, clearReauthCookie, getCurrentUser } from '@/server/auth'
import { db } from '@/server/db'
import { users } from '@/server/db/schema'
import { jsonSuccess } from '@/server/lib/api-response'
import { logActivity } from '@/server/services/activity-logs'
import { eq, sql } from 'drizzle-orm'
import { NextRequest } from 'next/server'

export async function POST(request: NextRequest) {
  const user = await getCurrentUser()

  if (user) {
    // 自增 tokenVersion 让所有已签发的 JWT 立即失效（即便 cookie 外泄也不可用）
    await db
      .update(users)
      .set({ tokenVersion: sql`${users.tokenVersion} + 1` })
      .where(eq(users.id, user.id))
  }

  await clearAuthCookie()
  await clearReauthCookie()

  if (user) {
    await logActivity(request, user.id, 'logout')
  }

  return jsonSuccess()
}
