import { beforeEach, describe, expect, it } from 'vitest'
import { setupTestDb } from './__test__/setup'

const { createEmailLog, listEmailLogs, deleteEmailLog, cleanOldEmailLogs } =
  await import('./email-logs')

beforeEach(async () => {
  await setupTestDb()
})

describe('createEmailLog + listEmailLogs', () => {
  it('创建日志并分页查询', async () => {
    await createEmailLog({
      eventType: 'test',
      recipients: ['a@test.com'],
      subject: '测试邮件',
      status: 'success',
    })
    await createEmailLog({
      eventType: 'new_comment',
      recipients: ['b@test.com', 'c@test.com'],
      subject: '新评论',
      status: 'fail',
      errorMessage: 'SMTP timeout',
    })

    const result = await listEmailLogs({ page: 1, pageSize: 10 })
    expect(result.total).toBe(2)
    expect(result.items).toHaveLength(2)

    const types = result.items.map((i) => i.eventType).sort()
    expect(types).toEqual(['new_comment', 'test'])

    const failItem = result.items.find((i) => i.status === 'fail')!
    expect(failItem.eventType).toBe('new_comment')
    expect(failItem.recipients).toEqual(['b@test.com', 'c@test.com'])
    expect(failItem.errorMessage).toBe('SMTP timeout')

    const successItem = result.items.find((i) => i.status === 'success')!
    expect(successItem.eventType).toBe('test')
    expect(successItem.recipients).toEqual(['a@test.com'])
  })

  it('分页返回正确的子集', async () => {
    for (let i = 0; i < 5; i++) {
      await createEmailLog({
        eventType: 'test',
        recipients: [`user${i}@test.com`],
        subject: `邮件 ${i}`,
        status: 'success',
      })
    }

    const page1 = await listEmailLogs({ page: 1, pageSize: 2 })
    expect(page1.total).toBe(5)
    expect(page1.items).toHaveLength(2)

    const page3 = await listEmailLogs({ page: 3, pageSize: 2 })
    expect(page3.items).toHaveLength(1)
  })
})

describe('deleteEmailLog', () => {
  it('删除指定日志', async () => {
    await createEmailLog({
      eventType: 'test',
      recipients: ['a@test.com'],
      subject: '测试',
      status: 'success',
    })
    const { items } = await listEmailLogs({ page: 1, pageSize: 10 })
    expect(items).toHaveLength(1)

    await deleteEmailLog(items[0].id)

    const after = await listEmailLogs({ page: 1, pageSize: 10 })
    expect(after.total).toBe(0)
  })
})

describe('cleanOldEmailLogs', () => {
  it('清理 30 天前的记录，保留近期记录', async () => {
    // 手动插入一条旧记录
    const { db } = await import('@/server/db')
    const { emailLogs } = await import('@/server/db/schema')
    await db.insert(emailLogs).values({
      eventType: 'test',
      recipients: '["old@test.com"]',
      subject: '旧邮件',
      status: 'success',
      createdAt: new Date(Date.now() - 31 * 24 * 60 * 60 * 1000).toISOString(),
    })

    // 插入一条新记录
    await createEmailLog({
      eventType: 'test',
      recipients: ['new@test.com'],
      subject: '新邮件',
      status: 'success',
    })

    const before = await listEmailLogs({ page: 1, pageSize: 10 })
    expect(before.total).toBe(2)

    await cleanOldEmailLogs()

    const after = await listEmailLogs({ page: 1, pageSize: 10 })
    expect(after.total).toBe(1)
    expect(after.items[0].recipients).toEqual(['new@test.com'])
  })
})
