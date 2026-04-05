import { beforeEach, describe, expect, it } from 'vitest'
import { rateEvents } from '@/server/db/schema'
import { setupTestDb, testDb } from '@/server/services/__test__/setup'
import {
  acquireSubmissionSlot,
  cleanExpiredRateEvents,
  isLoginLocked,
  recordRateEvent,
} from './rate-limit'

beforeEach(async () => {
  await setupTestDb()
  await testDb.delete(rateEvents)
})

describe('recordRateEvent', () => {
  it('写入事件记录', async () => {
    await recordRateEvent('login_fail', 'admin', '127.0.0.1')
    const rows = await testDb.select().from(rateEvents)
    expect(rows).toHaveLength(1)
    expect(rows[0].eventType).toBe('login_fail')
    expect(rows[0].identifier).toBe('admin')
    expect(rows[0].ipAddress).toBe('127.0.0.1')
  })
})

describe('isLoginLocked', () => {
  it('失败次数不足 5 次时不锁定', async () => {
    for (let i = 0; i < 4; i++) {
      await recordRateEvent('login_fail', 'admin')
    }
    expect(await isLoginLocked('admin')).toBe(false)
  })

  it('失败达到 5 次时锁定', async () => {
    for (let i = 0; i < 5; i++) {
      await recordRateEvent('login_fail', 'admin')
    }
    expect(await isLoginLocked('admin')).toBe(true)
  })

  it('不同用户名互不影响', async () => {
    for (let i = 0; i < 5; i++) {
      await recordRateEvent('login_fail', 'user-a')
    }
    expect(await isLoginLocked('user-a')).toBe(true)
    expect(await isLoginLocked('user-b')).toBe(false)
  })

  it('超过 5 分钟窗口的记录不计入', async () => {
    const oldTime = new Date(Date.now() - 6 * 60 * 1000).toISOString()
    for (let i = 0; i < 5; i++) {
      await testDb.insert(rateEvents).values({
        eventType: 'login_fail',
        identifier: 'admin',
        createdAt: oldTime,
      })
    }
    expect(await isLoginLocked('admin')).toBe(false)
  })
})

describe('acquireSubmissionSlot', () => {
  it('无记录时返回 true 并写入事件', async () => {
    const result = await acquireSubmissionSlot('comment', 'session-1', '127.0.0.1')
    expect(result).toBe(true)

    const rows = await testDb.select().from(rateEvents)
    expect(rows).toHaveLength(1)
    expect(rows[0].eventType).toBe('comment')
    expect(rows[0].identifier).toBe('session-1')
  })

  it('已有记录时返回 false 且不新增记录', async () => {
    await acquireSubmissionSlot('comment', 'session-1')
    const result = await acquireSubmissionSlot('comment', 'session-1')
    expect(result).toBe(false)

    const rows = await testDb.select().from(rateEvents)
    expect(rows).toHaveLength(1)
  })

  it('不同 session 互不影响', async () => {
    await acquireSubmissionSlot('comment', 'session-1')
    const result = await acquireSubmissionSlot('comment', 'session-2')
    expect(result).toBe(true)
  })

  it('不同事件类型互不影响', async () => {
    await acquireSubmissionSlot('guestbook', 'session-1')
    const result = await acquireSubmissionSlot('comment', 'session-1')
    expect(result).toBe(true)
  })

  it('超过 30 秒的记录不影响', async () => {
    const oldTime = new Date(Date.now() - 31 * 1000).toISOString()
    await testDb.insert(rateEvents).values({
      eventType: 'comment',
      identifier: 'session-1',
      createdAt: oldTime,
    })
    const result = await acquireSubmissionSlot('comment', 'session-1')
    expect(result).toBe(true)
  })
})

describe('cleanExpiredRateEvents', () => {
  it('清理 24 小时前的记录，保留近期记录', async () => {
    const oldTime = new Date(Date.now() - 25 * 60 * 60 * 1000).toISOString()
    await testDb.insert(rateEvents).values({
      eventType: 'login_fail',
      identifier: 'old-user',
      createdAt: oldTime,
    })
    await recordRateEvent('login_fail', 'recent-user')

    await cleanExpiredRateEvents()

    const rows = await testDb.select().from(rateEvents)
    expect(rows).toHaveLength(1)
    expect(rows[0].identifier).toBe('recent-user')
  })
})
