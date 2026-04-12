import { normalizeEmail, normalizePassword, normalizeUsername } from '@/lib/user-input'
import { hashPassword } from '@/server/auth'
import { db } from '@/server/db'
import { insertOne, maybeFirst, updateOne } from '@/server/db/query'
import { activityLogs, users } from '@/server/db/schema'
import { eq } from 'drizzle-orm'

/** 列出所有用户 */
export async function listUsers() {
  return db
    .select({
      id: users.id,
      username: users.username,
      email: users.email,
      role: users.role,
      createdAt: users.createdAt,
    })
    .from(users)
}

/** 获取单个用户 */
export async function getUserById(id: number) {
  return maybeFirst(
    db
      .select({
        id: users.id,
        username: users.username,
        email: users.email,
        role: users.role,
        createdAt: users.createdAt,
      })
      .from(users)
      .where(eq(users.id, id))
      .limit(1),
  )
}

/** 创建用户 */
export async function createUser(input: {
  username: string
  password: string
  email?: string
  role: 'admin' | 'editor'
}) {
  const username = normalizeUsername(input.username)
  const password = normalizePassword(input.password)
  if (!username) throw new Error('Username cannot be empty after normalization')
  if (!password) throw new Error('Password cannot be empty after normalization')

  const passwordHash = await hashPassword(password)
  return insertOne(
    db
      .insert(users)
      .values({
        username,
        email: normalizeEmail(input.email),
        passwordHash,
        role: input.role,
      })
      .returning(),
  )
}

/** 更新用户 */
export async function updateUser(
  id: number,
  input: {
    username?: string
    email?: string
    password?: string
    role?: 'owner' | 'admin' | 'editor'
  },
) {
  const updateData: Record<string, any> = { updatedAt: new Date().toISOString() }

  if (input.username !== undefined) {
    const username = normalizeUsername(input.username)
    if (!username) throw new Error('Username cannot be empty after normalization')
    updateData.username = username
  }
  if (input.email !== undefined) updateData.email = normalizeEmail(input.email)
  if (input.password !== undefined) {
    const password = normalizePassword(input.password)
    if (!password) throw new Error('Password cannot be empty after normalization')
    updateData.passwordHash = await hashPassword(password)
  }
  if (input.role) updateData.role = input.role

  return updateOne(db.update(users).set(updateData).where(eq(users.id, id)).returning())
}

/** 删除用户 */
export type DeleteUserResult =
  | { success: true }
  | { success: false; code: 'CANNOT_DELETE_SELF' | 'NOT_FOUND' }

export async function deleteUser(id: number, operatorId: number): Promise<DeleteUserResult> {
  if (id === operatorId) return { success: false, code: 'CANNOT_DELETE_SELF' }
  const user = await maybeFirst(db.select().from(users).where(eq(users.id, id)).limit(1))
  if (!user) return { success: false, code: 'NOT_FOUND' }

  // 先清除活动日志，避免外键约束阻塞删除
  await db.delete(activityLogs).where(eq(activityLogs.userId, id))
  await db.delete(users).where(eq(users.id, id))
  return { success: true }
}
