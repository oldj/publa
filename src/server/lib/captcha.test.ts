import { captchas } from '@/server/db/schema'
import { setupTestDb, testDb } from '@/server/services/__test__/setup'
import { eq } from 'drizzle-orm'
import { beforeEach, describe, expect, it } from 'vitest'
import { verifyCaptcha } from './captcha'

beforeEach(async () => {
  await setupTestDb()
})

async function seedCaptcha(sessionId: string, text: string, expiresAt: string) {
  await testDb.insert(captchas).values({ sessionId, text, expiresAt })
}

const future = () => new Date(Date.now() + 60_000).toISOString()
const past = () => new Date(Date.now() - 60_000).toISOString()

describe('verifyCaptcha', () => {
  it('正确码返回 true 并删除对应行', async () => {
    await seedCaptcha('sess-1', 'abcd', future())

    expect(await verifyCaptcha('sess-1', 'abcd')).toBe(true)

    const rows = await testDb.select().from(captchas).where(eq(captchas.sessionId, 'sess-1'))
    expect(rows).toHaveLength(0)
  })

  it('错误码返回 false，但仍删除行（一次性消费）', async () => {
    await seedCaptcha('sess-1', 'abcd', future())

    expect(await verifyCaptcha('sess-1', 'wrong')).toBe(false)

    const rows = await testDb.select().from(captchas).where(eq(captchas.sessionId, 'sess-1'))
    expect(rows).toHaveLength(0)
  })

  it('过期码返回 false', async () => {
    await seedCaptcha('sess-1', 'abcd', past())

    expect(await verifyCaptcha('sess-1', 'abcd')).toBe(false)
  })

  it('不存在的 sessionId 返回 false', async () => {
    expect(await verifyCaptcha('sess-missing', 'abcd')).toBe(false)
  })

  it('验证码大小写不敏感', async () => {
    await seedCaptcha('sess-1', 'abcd', future())
    expect(await verifyCaptcha('sess-1', 'AbCd')).toBe(true)
  })

  // 核心回归保护：DELETE ... RETURNING 保证同一行只能被消费一次。
  // 旧实现「先 SELECT 后 DELETE」在并发下可能让两条都拿到 true。
  it('同一验证码并发提交只有一次返回 true', async () => {
    await seedCaptcha('sess-1', 'abcd', future())

    const results = await Promise.all([
      verifyCaptcha('sess-1', 'abcd'),
      verifyCaptcha('sess-1', 'abcd'),
    ])

    expect(results.filter(Boolean)).toHaveLength(1)
  })
})
