import { verifyPassword } from '@/server/auth'
import { maybeFirst } from '@/server/db/query'
import { users } from '@/server/db/schema'
import { eq } from 'drizzle-orm'
import { beforeEach, describe, expect, it } from 'vitest'
import { setupTestDb } from './__test__/setup'

// setup.ts 中已执行 vi.mock('@/server/db')
const { listUsers, getUserById, createUser, updateUser, deleteUser } = await import('./users')

beforeEach(async () => {
  await setupTestDb()
})

describe('listUsers', () => {
  it('列出所有用户', async () => {
    const users = await listUsers()
    expect(users).toHaveLength(2)
    expect(users.map((u) => u.username)).toContain('admin')
    expect(users.map((u) => u.username)).toContain('editor')
  })

  it('不返回密码字段', async () => {
    const users = await listUsers()
    for (const u of users) {
      expect(u).not.toHaveProperty('passwordHash')
    }
  })
})

describe('getUserById', () => {
  it('获取存在的用户', async () => {
    const user = await getUserById(1)
    expect(user).not.toBeNull()
    expect(user!.username).toBe('admin')
    expect(user!.role).toBe('owner')
  })

  it('不存在的用户返回 null', async () => {
    const user = await getUserById(999)
    expect(user).toBeNull()
  })

  it('不返回密码字段', async () => {
    const user = await getUserById(1)
    expect(user).not.toHaveProperty('passwordHash')
  })
})

describe('createUser', () => {
  it('创建编辑用户', async () => {
    const user = await createUser({
      username: 'neweditor',
      password: 'password123',
      role: 'editor',
    })
    expect(user.username).toBe('neweditor')
    expect(user.role).toBe('editor')

    const fetched = await getUserById(user.id)
    expect(fetched).not.toBeNull()
    expect(fetched!.username).toBe('neweditor')
  })

  it('创建管理员用户', async () => {
    const user = await createUser({
      username: 'newadmin',
      password: 'password123',
      role: 'admin',
    })
    expect(user.role).toBe('admin')
  })

  it('创建时可设置邮箱', async () => {
    const user = await createUser({
      username: 'withemail',
      password: 'password123',
      email: 'test@example.com',
      role: 'editor',
    })
    const fetched = await getUserById(user.id)
    expect(fetched!.email).toBe('test@example.com')
  })

  it('密码经过哈希处理', async () => {
    const user = await createUser({
      username: 'hashtest',
      password: 'mypassword',
      role: 'editor',
    })
    // passwordHash 不应等于明文密码
    expect(user.passwordHash).not.toBe('mypassword')
    expect(user.passwordHash.length).toBeGreaterThan(10)
  })

  it('创建时会清洗用户名邮箱和密码', async () => {
    const user = await createUser({
      username: '  trimmed-user  ',
      password: '  mypassword  ',
      email: '  trim@example.com  ',
      role: 'editor',
    })

    expect(user.username).toBe('trimmed-user')

    const saved = await import('@/server/db').then(({ db }) =>
      maybeFirst(db.select().from(users).where(eq(users.id, user.id)).limit(1)),
    )
    expect(saved!.email).toBe('trim@example.com')
    expect(await verifyPassword('mypassword', saved!.passwordHash)).toBe(true)
  })
})

describe('updateUser', () => {
  it('更新用户名', async () => {
    const updated = await updateUser(2, { username: 'newname' })
    expect(updated?.username).toBe('newname')

    const fetched = await getUserById(2)
    expect(fetched!.username).toBe('newname')
  })

  it('更新邮箱', async () => {
    await updateUser(2, { email: 'new@example.com' })
    const fetched = await getUserById(2)
    expect(fetched!.email).toBe('new@example.com')
  })

  it('清空邮箱', async () => {
    await updateUser(2, { email: 'temp@example.com' })
    await updateUser(2, { email: '' })
    const fetched = await getUserById(2)
    expect(fetched!.email).toBeNull()
  })

  it('更新密码', async () => {
    const before = await import('@/server/db').then(({ db }) =>
      maybeFirst(db.select().from(users).where(eq(users.id, 2)).limit(1)),
    )
    const oldHash = before!.passwordHash

    await updateUser(2, { password: 'newpassword' })

    const after = await import('@/server/db').then(({ db }) =>
      maybeFirst(db.select().from(users).where(eq(users.id, 2)).limit(1)),
    )
    expect(after!.passwordHash).not.toBe(oldHash)
    expect(after!.passwordHash).not.toBe('newpassword')
  })

  it('更新时会清洗用户名邮箱和密码', async () => {
    await updateUser(2, {
      username: '  newname  ',
      email: '  new@example.com  ',
      password: '  newpassword  ',
    })

    const after = await import('@/server/db').then(({ db }) =>
      maybeFirst(db.select().from(users).where(eq(users.id, 2)).limit(1)),
    )
    expect(after!.username).toBe('newname')
    expect(after!.email).toBe('new@example.com')
    expect(await verifyPassword('newpassword', after!.passwordHash)).toBe(true)
  })

  it('更新角色', async () => {
    await updateUser(2, { role: 'admin' })
    const fetched = await getUserById(2)
    expect(fetched!.role).toBe('admin')
  })

  it('不传字段时不修改', async () => {
    const before = await getUserById(2)
    await updateUser(2, {})
    const after = await getUserById(2)
    expect(after!.username).toBe(before!.username)
    expect(after!.email).toBe(before!.email)
    expect(after!.role).toBe(before!.role)
  })
})

describe('deleteUser', () => {
  it('删除用户', async () => {
    const result = await deleteUser(2, 1)
    expect(result.success).toBe(true)

    const fetched = await getUserById(2)
    expect(fetched).toBeNull()
  })

  it('不能删除自己', async () => {
    const result = await deleteUser(1, 1)
    expect(result.success).toBe(false)
    expect(result.message).toBe('不能删除自己')

    // 用户仍然存在
    const fetched = await getUserById(1)
    expect(fetched).not.toBeNull()
  })

  it('删除不存在的用户', async () => {
    const result = await deleteUser(999, 1)
    expect(result.success).toBe(false)
    expect(result.message).toBe('用户不存在')
  })

  it('站长可以删除其他站长', async () => {
    // 创建另一个站长
    const owner2 = await createUser({ username: 'owner2', password: 'pass', role: 'admin' })
    await updateUser(owner2.id, { role: 'owner' })

    const result = await deleteUser(owner2.id, 1)
    expect(result.success).toBe(true)
  })

  it('删除后用户列表减少', async () => {
    const before = await listUsers()
    await deleteUser(2, 1)
    const after = await listUsers()
    expect(after).toHaveLength(before.length - 1)
  })
})
