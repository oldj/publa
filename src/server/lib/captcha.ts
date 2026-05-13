import { db } from '@/server/db'
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

/** 验证验证码（验证即销毁，原子一步式消费） */
export async function verifyCaptcha(sessionId: string, input: string): Promise<boolean> {
  // 使用 DELETE ... RETURNING 一步完成"查出并消费"，
  // 同一行只可能被一条并发语句拿到，避免"先查后删"的复用窗口。
  // SQLite (libsql) 与 PostgreSQL 均原生支持该语法。
  const [row] = await db.delete(captchas).where(eq(captchas.sessionId, sessionId)).returning()

  if (!row) return false
  if (row.expiresAt < new Date().toISOString()) return false
  return row.text === input.toLowerCase()
}

/** 清理过期记录 */
export async function cleanExpiredCaptchas() {
  await db.delete(captchas).where(lt(captchas.expiresAt, new Date().toISOString()))
}
