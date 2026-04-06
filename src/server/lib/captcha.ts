import { db } from '@/server/db'
import { maybeFirst } from '@/server/db/query'
import { captchas } from '@/server/db/schema'
import { eq, lt } from 'drizzle-orm'
import svgCaptcha from 'svg-captcha'

/** 生成验证码 */
export async function generateCaptcha(sessionId: string) {
  const captcha = svgCaptcha.create({
    size: 4,
    noise: 2,
    color: true,
    background: '#f0f0f0',
  })

  const expiresAt = new Date(Date.now() + 5 * 60 * 1000).toISOString()

  await db
    .insert(captchas)
    .values({
      sessionId,
      text: captcha.text.toLowerCase(),
      expiresAt,
    })
    .onConflictDoUpdate({
      target: captchas.sessionId,
      set: { text: captcha.text.toLowerCase(), expiresAt },
    })

  return captcha.data // SVG 字符串
}

/** 验证验证码（验证即销毁） */
export async function verifyCaptcha(sessionId: string, input: string): Promise<boolean> {
  const row = await maybeFirst(
    db.select().from(captchas).where(eq(captchas.sessionId, sessionId)).limit(1),
  )
  if (!row) return false

  // 先检查过期，再删除，避免过期验证码被无意义地删除
  if (row.expiresAt < new Date().toISOString()) return false

  await db.delete(captchas).where(eq(captchas.sessionId, sessionId))

  return row.text === input.toLowerCase()
}

/** 清理过期记录 */
export async function cleanExpiredCaptchas() {
  await db.delete(captchas).where(lt(captchas.expiresAt, new Date().toISOString()))
}
