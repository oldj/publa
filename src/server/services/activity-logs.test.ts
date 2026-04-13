import { beforeEach, describe, expect, it } from 'vitest'
import { setupTestDb } from './__test__/setup'

const { createActivityLog, listUserActivityLogs, getLastActiveMap, cleanOldActivityLogs } =
  await import('./activity-logs')

beforeEach(async () => {
  await setupTestDb()
})

describe('createActivityLog + listUserActivityLogs', () => {
  it('创建日志并查询', async () => {
    await createActivityLog({ userId: 1, action: 'login', ipAddress: '1.2.3.4', userAgent: 'ua' })
    await createActivityLog({ userId: 1, action: 'create_post' })
    await createActivityLog({ userId: 2, action: 'login' })

    const result = await listUserActivityLogs({ userId: 1 })
    expect(result.total).toBe(2)
    expect(result.items).toHaveLength(2)

    const actions = result.items.map((i) => i.action).sort()
    expect(actions).toEqual(['create_post', 'login'])

    const loginItem = result.items.find((i) => i.action === 'login')!
    expect(loginItem.ipAddress).toBe('1.2.3.4')
    expect(loginItem.userAgent).toBe('ua')

    // 未传的可选字段为 null
    const postItem = result.items.find((i) => i.action === 'create_post')!
    expect(postItem.ipAddress).toBeNull()
    expect(postItem.userAgent).toBeNull()
  })

  it('分页返回正确的子集', async () => {
    for (let i = 0; i < 5; i++) {
      await createActivityLog({ userId: 1, action: 'update_post' })
    }

    const page1 = await listUserActivityLogs({ userId: 1, page: 1, pageSize: 2 })
    expect(page1.total).toBe(5)
    expect(page1.items).toHaveLength(2)

    const page3 = await listUserActivityLogs({ userId: 1, page: 3, pageSize: 2 })
    expect(page3.items).toHaveLength(1)
  })

  it('不同用户的日志互不干扰', async () => {
    await createActivityLog({ userId: 1, action: 'login' })
    await createActivityLog({ userId: 2, action: 'login' })

    const user1 = await listUserActivityLogs({ userId: 1 })
    const user2 = await listUserActivityLogs({ userId: 2 })
    expect(user1.total).toBe(1)
    expect(user2.total).toBe(1)
  })
})

describe('getLastActiveMap', () => {
  it('返回每个用户最后活跃时间', async () => {
    await createActivityLog({ userId: 1, action: 'login' })
    await createActivityLog({ userId: 1, action: 'create_post' })
    await createActivityLog({ userId: 2, action: 'login' })

    const map = await getLastActiveMap()
    expect(map.size).toBe(2)
    expect(map.has(1)).toBe(true)
    expect(map.has(2)).toBe(true)
    // user2 最后活跃时间 >= user1（因为 user2 的 login 在 user1 的 create_post 之后插入）
    expect(map.get(2)! >= map.get(1)!).toBe(true)
  })

  it('无日志时返回空 Map', async () => {
    const map = await getLastActiveMap()
    expect(map.size).toBe(0)
  })
})

describe('cleanOldActivityLogs', () => {
  it('清理 30 天前的记录，保留近期记录', async () => {
    // 手动插入一条旧记录
    const { db } = await import('@/server/db')
    const { activityLogs } = await import('@/server/db/schema')
    await db.insert(activityLogs).values({
      userId: 1,
      action: 'login',
      createdAt: new Date(Date.now() - 31 * 24 * 60 * 60 * 1000).toISOString(),
    })

    // 插入一条新记录
    await createActivityLog({ userId: 1, action: 'create_post' })

    const before = await listUserActivityLogs({ userId: 1 })
    expect(before.total).toBe(2)

    await cleanOldActivityLogs()

    const after = await listUserActivityLogs({ userId: 1 })
    expect(after.total).toBe(1)
    expect(after.items[0].action).toBe('create_post')
  })
})
