import * as schema from '@/server/db/schema'
import { maybeFirst } from '@/server/db/query'
import { eq } from 'drizzle-orm'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { setupTestDb, testDb } from './__test__/setup'

// Mock 存储模块
const mockStorage = {
  save: vi.fn().mockResolvedValue({ key: 'mocked' }),
  delete: vi.fn().mockResolvedValue(undefined),
  exists: vi.fn().mockResolvedValue(false),
  move: vi.fn().mockResolvedValue(undefined),
  testConnection: vi.fn().mockResolvedValue({ success: true }),
}

vi.mock('@/server/storage', () => ({
  getStorageProvider: vi.fn().mockResolvedValue(mockStorage),
}))

const { uploadAttachment, listAttachments, getAttachment, renameAttachment, deleteAttachment } =
  await import('./attachments')

beforeEach(async () => {
  await setupTestDb()
  // 设置存储配置
  await testDb.insert(schema.settings).values([
    { key: 'storageProvider', value: '"s3"' },
    { key: 'attachmentBaseUrl', value: '"https://cdn.example.com"' },
  ])
  // 重置 mock
  vi.clearAllMocks()
  mockStorage.save.mockResolvedValue({ key: 'mocked' })
  mockStorage.delete.mockResolvedValue(undefined)
  mockStorage.exists.mockResolvedValue(false)
  mockStorage.move.mockResolvedValue(undefined)
})

/** 插入一条附件记录用于测试 */
async function insertAttachment(overrides: Partial<typeof schema.attachments.$inferInsert> = {}) {
  const [row] = await testDb
    .insert(schema.attachments)
    .values({
      filename: 'test.png',
      originalFilename: 'test.png',
      mimeType: 'image/png',
      size: 1024,
      storageProvider: 's3',
      storageKey: '/uploads/2026/03/31/test.png',
      uploadedBy: 1,
      ...overrides,
    })
    .returning()
  return row
}

// --- buildStorageKey 路径遍历防护 ---

describe('uploadAttachment', () => {
  it('正常上传并写入数据库', async () => {
    const result = await uploadAttachment({
      file: Buffer.from('data'),
      originalFilename: 'photo.jpg',
      mimeType: 'image/jpeg',
      size: 100,
      uploadedBy: 1,
    })

    expect(result.originalFilename).toBe('photo.jpg')
    expect(result.storageKey).toMatch(/^\/uploads\/\d{4}\/\d{2}\/\d{2}\/photo\.jpg$/)
    expect(result.storageProvider).toBe('s3')
    expect(mockStorage.save).toHaveBeenCalledOnce()
  })

  it('路径遍历文件名被过滤为纯文件名', async () => {
    const result = await uploadAttachment({
      file: Buffer.from('data'),
      originalFilename: '../../etc/passwd',
      mimeType: 'text/plain',
      size: 10,
      uploadedBy: 1,
    })

    // storageKey 不应包含 ..，只保留 passwd
    expect(result.storageKey).not.toContain('..')
    expect(result.storageKey).toMatch(/\/passwd$/)
  })

  it('文件名冲突时自动加后缀', async () => {
    // 先上传一个文件
    await uploadAttachment({
      file: Buffer.from('data1'),
      originalFilename: 'dup.png',
      mimeType: 'image/png',
      size: 10,
      uploadedBy: 1,
    })

    // 再上传同名文件
    const result = await uploadAttachment({
      file: Buffer.from('data2'),
      originalFilename: 'dup.png',
      mimeType: 'image/png',
      size: 10,
      uploadedBy: 1,
    })

    expect(result.storageKey).toMatch(/dup-1\.png$/)
  })
})

// --- renameAttachment 校验 ---

describe('renameAttachment', () => {
  it('拒绝包含 .. 的 key', async () => {
    const att = await insertAttachment()
    await expect(renameAttachment(att.id, '/uploads/2026/../../../evil')).rejects.toThrow(
      'Invalid storage key',
    )
  })

  it('拒绝不以 /upload/ 或 /uploads/ 开头的 key', async () => {
    const att = await insertAttachment()
    await expect(renameAttachment(att.id, '/other/path/file.png')).rejects.toThrow(
      'Storage key must start with /upload/ or /uploads/',
    )
  })

  it('附件不存在时抛出错误', async () => {
    await expect(renameAttachment(99999, '/uploads/2026/03/31/new.png')).rejects.toThrow(
      'Attachment not found',
    )
  })

  it('已删除的附件不能重命名', async () => {
    const att = await insertAttachment({ deletedAt: new Date().toISOString() })
    await expect(renameAttachment(att.id, '/uploads/2026/03/31/new.png')).rejects.toThrow(
      'Attachment has been deleted',
    )
  })

  it('目标 key 与当前相同时直接返回', async () => {
    const att = await insertAttachment()
    const result = await renameAttachment(att.id, att.storageKey)
    expect(result.storageKey).toBe(att.storageKey)
    expect(mockStorage.move).not.toHaveBeenCalled()
  })

  it('DB 中存在同名未删除记录时拒绝', async () => {
    const att = await insertAttachment()
    await insertAttachment({
      filename: 'other.png',
      originalFilename: 'other.png',
      storageKey: '/uploads/2026/03/31/target.png',
    })

    await expect(renameAttachment(att.id, '/uploads/2026/03/31/target.png')).rejects.toThrow(
      'Target storage key already exists in database',
    )
  })

  it('正常重命名更新数据库和调用远程 move', async () => {
    const att = await insertAttachment()
    const newKey = '/uploads/2026/03/31/renamed.png'

    const result = await renameAttachment(att.id, newKey)

    expect(result.storageKey).toBe(newKey)
    expect(result.filename).toBe('renamed.png')
    expect(mockStorage.move).toHaveBeenCalledWith(att.storageKey, newKey)

    // 验证数据库已更新
    const dbRow = await maybeFirst(
      testDb.select().from(schema.attachments).where(eq(schema.attachments.id, att.id)).limit(1),
    )
    expect(dbRow!.storageKey).toBe(newKey)
    expect(dbRow!.filename).toBe('renamed.png')
  })
})

// --- deleteAttachment ---

describe('deleteAttachment', () => {
  it('附件不存在时返回失败', async () => {
    const result = await deleteAttachment(99999)
    expect(result.success).toBe(false)
    if (!result.success) {
      expect(result.code).toBe('NOT_FOUND')
    }
  })

  it('正常删除：先删云端再硬删本地记录', async () => {
    const att = await insertAttachment()
    const result = await deleteAttachment(att.id)

    expect(result.success).toBe(true)
    expect(mockStorage.delete).toHaveBeenCalledWith(att.storageKey)

    // 验证数据库记录已被硬删
    const dbRow = await maybeFirst(
      testDb.select().from(schema.attachments).where(eq(schema.attachments.id, att.id)).limit(1),
    )
    expect(dbRow).toBeNull()
  })

  it('云端删除失败时本地记录保留', async () => {
    const att = await insertAttachment()
    mockStorage.delete.mockRejectedValueOnce(new Error('Network error'))

    const result = await deleteAttachment(att.id)

    expect(result.success).toBe(false)
    if (!result.success) {
      expect(result.code).toBe('DELETE_REMOTE_FAILED')
    }

    // 验证数据库记录仍然存在
    const dbRow = await maybeFirst(
      testDb.select().from(schema.attachments).where(eq(schema.attachments.id, att.id)).limit(1),
    )
    expect(dbRow).toBeDefined()
    expect(dbRow!.deletedAt).toBeNull()
  })

  it('云端文件已不存在（404）时仍删除本地记录', async () => {
    const att = await insertAttachment()
    const notFoundErr: any = new Error('NotFound')
    notFoundErr.name = 'NotFound'
    notFoundErr.$metadata = { httpStatusCode: 404 }
    mockStorage.delete.mockRejectedValueOnce(notFoundErr)

    const result = await deleteAttachment(att.id)

    expect(result.success).toBe(true)

    const dbRow = await maybeFirst(
      testDb.select().from(schema.attachments).where(eq(schema.attachments.id, att.id)).limit(1),
    )
    expect(dbRow).toBeNull()
  })
})

// --- listAttachments ---

describe('listAttachments', () => {
  it('不返回已软删除的附件', async () => {
    await insertAttachment({
      filename: 'active.png',
      originalFilename: 'active.png',
      storageKey: '/uploads/2026/03/31/active.png',
    })
    await insertAttachment({
      filename: 'deleted.png',
      originalFilename: 'deleted.png',
      storageKey: '/uploads/2026/03/31/deleted.png',
      deletedAt: new Date().toISOString(),
    })

    const result = await listAttachments()
    expect(result.items).toHaveLength(1)
    expect(result.items[0].filename).toBe('active.png')
  })

  it('mimeTypePrefix 只返回匹配类型的附件', async () => {
    await insertAttachment({
      filename: 'photo.png',
      originalFilename: 'photo.png',
      mimeType: 'image/png',
      storageKey: '/uploads/2026/03/31/photo.png',
    })
    await insertAttachment({
      filename: 'doc.pdf',
      originalFilename: 'doc.pdf',
      mimeType: 'application/pdf',
      storageKey: '/uploads/2026/03/31/doc.pdf',
    })
    await insertAttachment({
      filename: 'avatar.jpeg',
      originalFilename: 'avatar.jpeg',
      mimeType: 'image/jpeg',
      storageKey: '/uploads/2026/03/31/avatar.jpeg',
    })

    const imageOnly = await listAttachments({ mimeTypePrefix: 'image/' })
    expect(imageOnly.items).toHaveLength(2)
    expect(imageOnly.items.every((i) => i.mimeType.startsWith('image/'))).toBe(true)
    expect(imageOnly.itemCount).toBe(2)

    const all = await listAttachments()
    expect(all.items).toHaveLength(3)
    expect(all.itemCount).toBe(3)
  })

  it('分页参数正确', async () => {
    for (let i = 0; i < 5; i++) {
      await insertAttachment({
        filename: `f${i}.png`,
        originalFilename: `f${i}.png`,
        storageKey: `/uploads/2026/03/31/f${i}.png`,
      })
    }

    const page1 = await listAttachments({ page: 1, pageSize: 2 })
    expect(page1.items).toHaveLength(2)
    expect(page1.itemCount).toBe(5)
    expect(page1.pageCount).toBe(3)
  })
})

// --- getAttachment ---

describe('getAttachment', () => {
  it('返回附件详情并拼接 publicUrl', async () => {
    const att = await insertAttachment()
    const result = await getAttachment(att.id)

    expect(result).not.toBeNull()
    expect(result!.publicUrl).toBe('https://cdn.example.com' + att.storageKey)
  })

  it('附件不存在时返回 null', async () => {
    const result = await getAttachment(99999)
    expect(result).toBeNull()
  })
})
