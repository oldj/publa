import { db } from '@/server/db'
import { insertOne, maybeFirst } from '@/server/db/query'
import { attachments } from '@/server/db/schema'
import { getStorageProvider } from '@/server/storage'
import { and, count, desc, eq, isNull, like, ne } from 'drizzle-orm'
import path from 'path'
import { getSetting } from './settings'

/** 生成上传路径：/uploads/YYYY/MM/DD/filename */
function buildStorageKey(filename: string): string {
  // 防止路径遍历：只保留文件名部分
  const safeFilename = path.basename(filename)
  if (!safeFilename) throw new Error('Invalid filename')

  const now = new Date()
  const y = now.getFullYear()
  const m = String(now.getMonth() + 1).padStart(2, '0')
  const d = String(now.getDate()).padStart(2, '0')
  return `/uploads/${y}/${m}/${d}/${safeFilename}`
}

/** 处理文件名冲突：查询 DB 中同目录下是否已有同名文件，有则加后缀 */
async function resolveFilename(filename: string): Promise<string> {
  const key = buildStorageKey(filename)
  const existing = await maybeFirst(
    db
      .select({ id: attachments.id })
      .from(attachments)
      .where(eq(attachments.storageKey, key))
      .limit(1),
  )
  if (!existing) return filename

  const ext = path.extname(filename)
  const base = path.basename(filename, ext)
  // 查找同目录下所有同前缀的文件
  const prefix = buildStorageKey(`${base}-`)
  const similars = await db
    .select({ storageKey: attachments.storageKey })
    .from(attachments)
    .where(like(attachments.storageKey, `${prefix}%`))

  let maxSuffix = 0
  for (const row of similars) {
    const name = path.basename(row.storageKey, ext)
    const match = name.match(new RegExp(`^${base.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}-(\\d+)$`))
    if (match) maxSuffix = Math.max(maxSuffix, parseInt(match[1]))
  }

  return `${base}-${maxSuffix + 1}${ext}`
}

/** 获取附件的完整 URL */
export async function getAttachmentUrl(storageKey: string): Promise<string> {
  const baseUrl = String((await getSetting('attachmentBaseUrl')) ?? '')
  return baseUrl + storageKey
}

/** 上传附件 */
export async function uploadAttachment(input: {
  file: Buffer
  originalFilename: string
  mimeType: string
  size: number
  width?: number
  height?: number
  uploadedBy: number
}) {
  const storage = await getStorageProvider()
  if (!storage) throw new Error('Storage not configured')

  const provider = String((await getSetting('storageProvider')) ?? '')
  const filename = await resolveFilename(input.originalFilename)
  const storageKey = buildStorageKey(filename)

  try {
    await storage.save(input.file, storageKey, input.mimeType)
  } catch (err: any) {
    const detail = err.Code || err.name || err.message || 'Unknown error'
    throw new Error(`Upload failed: ${detail}`)
  }

  return insertOne(
    db
      .insert(attachments)
      .values({
        filename: input.originalFilename,
        originalFilename: input.originalFilename,
        mimeType: input.mimeType,
        size: input.size,
        width: input.width || null,
        height: input.height || null,
        storageProvider: provider as 's3' | 'oss' | 'cos',
        storageKey,
        uploadedBy: input.uploadedBy,
      })
      .returning(),
  )
}

/** 列出附件（动态拼接完整 URL） */
export async function listAttachments(options: { page?: number; pageSize?: number } = {}) {
  const { page = 1, pageSize = 24 } = options
  const baseUrl = String((await getSetting('attachmentBaseUrl')) ?? '')

  const where = isNull(attachments.deletedAt)
  const [{ total }] = await db.select({ total: count() }).from(attachments).where(where)

  const rows = await db
    .select()
    .from(attachments)
    .where(where)
    .orderBy(desc(attachments.createdAt))
    .limit(pageSize)
    .offset((page - 1) * pageSize)

  const items = rows.map((r) => ({
    ...r,
    publicUrl: baseUrl + r.storageKey,
  }))

  return { items, page, pageSize, pageCount: Math.ceil(total / pageSize), itemCount: total }
}

/** 获取单个附件详情 */
export async function getAttachment(id: number) {
  const baseUrl = String((await getSetting('attachmentBaseUrl')) ?? '')
  const row = await maybeFirst(db.select().from(attachments).where(eq(attachments.id, id)).limit(1))
  if (!row) return null
  return { ...row, publicUrl: baseUrl + row.storageKey }
}

/** 重命名附件（修改 storageKey 和 filename） */
export async function renameAttachment(id: number, newStorageKey: string) {
  // 防止路径遍历
  if (newStorageKey.includes('..')) throw new Error('Invalid storage key')
  if (!newStorageKey.startsWith('/upload/') && !newStorageKey.startsWith('/uploads/'))
    throw new Error('Storage key must start with /upload/ or /uploads/')

  const attachment = await maybeFirst(
    db.select().from(attachments).where(eq(attachments.id, id)).limit(1),
  )
  if (!attachment) throw new Error('附件不存在')
  if (attachment.deletedAt) throw new Error('附件已删除')
  if (attachment.storageKey === newStorageKey) return attachment

  // 检查 DB 中是否存在同 storageKey 的其他未删除记录
  const dbConflict = await maybeFirst(
    db
      .select({ id: attachments.id })
      .from(attachments)
      .where(
        and(
          eq(attachments.storageKey, newStorageKey),
          ne(attachments.id, id),
          isNull(attachments.deletedAt),
        ),
      )
      .limit(1),
  )
  if (dbConflict) throw new Error('目标文件名已存在（数据库记录冲突）')

  // 检查远程存储是否已有同名文件
  const storage = await getStorageProvider()
  if (!storage) throw new Error('Storage not configured')
  const remoteExists = await storage.exists(newStorageKey)
  if (remoteExists) throw new Error('目标文件名在存储服务器上已存在')

  // 移动远程文件
  try {
    await storage.move(attachment.storageKey, newStorageKey)
  } catch (err: any) {
    const detail = err.Code || err.name || err.message || 'Unknown error'
    throw new Error(`远程文件移动失败: ${detail}`)
  }

  // 更新数据库
  const newFilename = path.basename(newStorageKey)
  await db
    .update(attachments)
    .set({
      filename: newFilename,
      storageKey: newStorageKey,
    })
    .where(eq(attachments.id, id))

  return { ...attachment, filename: newFilename, storageKey: newStorageKey }
}

/** 删除附件：先删云端文件，成功后硬删本地记录 */
export async function deleteAttachment(id: number) {
  const attachment = await maybeFirst(
    db.select().from(attachments).where(eq(attachments.id, id)).limit(1),
  )
  if (!attachment) return { success: false, message: '附件不存在' }

  // 先删除云端文件
  const storage = await getStorageProvider()
  if (storage) {
    try {
      await storage.delete(attachment.storageKey)
    } catch (err: any) {
      // 云端文件已不存在，视为删除成功
      const status = err.$metadata?.httpStatusCode || err.status || err.statusCode
      const isNotFound = status === 404 || err.name === 'NotFound' || err.name === 'NoSuchKey'
      if (!isNotFound) {
        const detail = err.Code || err.name || err.message || 'Unknown error'
        return { success: false, message: `云端文件删除失败: ${detail}` }
      }
    }
  }

  // 云端删除成功后硬删本地记录
  await db.delete(attachments).where(eq(attachments.id, id))

  return { success: true }
}
