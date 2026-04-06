import { requireCurrentUser, requireRole } from '@/server/auth'
import { normalizeEmail, normalizePassword, normalizeUsername } from '@/lib/user-input'
import { safeParseJson } from '@/server/lib/request'
import { getLastActiveMap, logActivity } from '@/server/services/activity-logs'
import { createUser, getUserById, listUsers } from '@/server/services/users'
import { NextRequest, NextResponse } from 'next/server'

export async function GET() {
  const guard = await requireCurrentUser()
  if (!guard.ok) return guard.response

  const lastActiveMap = await getLastActiveMap()

  // 编辑只能看到自己
  if (guard.user.role === 'editor') {
    const self = await getUserById(guard.user.id)
    const data = self ? [{ ...self, lastActiveAt: lastActiveMap.get(self.id) || null }] : []
    return NextResponse.json({ success: true, data })
  }

  const users = await listUsers()
  const data = users.map((u) => ({
    ...u,
    lastActiveAt: lastActiveMap.get(u.id) || null,
  }))
  return NextResponse.json({ success: true, data })
}

export async function POST(request: NextRequest) {
  const guard = await requireRole(['owner', 'admin'], '权限不足')
  if (!guard.ok) return guard.response

  const { data: body, error } = await safeParseJson(request)
  if (error) return error
  const username = normalizeUsername(body?.username)
  const password = normalizePassword(body?.password)
  const email = normalizeEmail(body?.email)

  if (!username || !password) {
    return NextResponse.json(
      { success: false, code: 'VALIDATION_ERROR', message: '用户名和密码不能为空' },
      { status: 400 },
    )
  }

  // 管理员只能创建编辑，站长可以创建管理员和编辑
  const role = body.role || 'editor'
  if (guard.user.role === 'admin' && role !== 'editor') {
    return NextResponse.json(
      { success: false, code: 'FORBIDDEN', message: '管理员只能创建编辑角色' },
      { status: 403 },
    )
  }
  if (role === 'owner') {
    return NextResponse.json(
      { success: false, code: 'FORBIDDEN', message: '不能创建站长角色' },
      { status: 403 },
    )
  }

  const newUser = await createUser({ username, password, email: email ?? undefined, role })
  await logActivity(request, guard.user.id, 'create_user')
  return NextResponse.json({
    success: true,
    data: { id: newUser.id, username: newUser.username, role: newUser.role },
  })
}
