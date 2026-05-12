import { normalizeEmail, normalizePassword, normalizeUsername } from '@/lib/user-input'
import { requireCurrentUser, requireRecentReauth, requireRole } from '@/server/auth'
import { jsonError, jsonSuccess } from '@/server/lib/api-response'
import { safeParseJson } from '@/server/lib/request'
import { getLastActiveMap, logActivity } from '@/server/services/activity-logs'
import { createUser, getUserById, listUsers } from '@/server/services/users'
import { NextRequest } from 'next/server'

export async function GET() {
  const guard = await requireCurrentUser()
  if (!guard.ok) return guard.response

  const lastActiveMap = await getLastActiveMap()

  // 编辑只能看到自己
  if (guard.user.role === 'editor') {
    const self = await getUserById(guard.user.id)
    const data = self ? [{ ...self, lastActiveAt: lastActiveMap.get(self.id) || null }] : []
    return jsonSuccess(data)
  }

  const users = await listUsers()
  const data = users.map((u) => ({
    ...u,
    lastActiveAt: lastActiveMap.get(u.id) || null,
  }))
  return jsonSuccess(data)
}

export async function POST(request: NextRequest) {
  const guard = await requireRole(['owner', 'admin'], {
    namespace: 'admin.api.users',
    key: 'forbidden',
  })
  if (!guard.ok) return guard.response
  const reauth = await requireRecentReauth(guard.user, request)
  if (!reauth.ok) return reauth.response

  const { data: body, error } = await safeParseJson(request)
  if (error) return error
  const username = normalizeUsername(body?.username)
  const password = normalizePassword(body?.password)
  const email = normalizeEmail(body?.email)

  if (!username || !password) {
    return jsonError({
      source: request,
      namespace: 'admin.api.users',
      key: 'usernameAndPasswordRequired',
      code: 'VALIDATION_ERROR',
      status: 400,
    })
  }

  // 管理员只能创建编辑，站长可以创建管理员和编辑
  const role = body.role || 'editor'
  if (guard.user.role === 'admin' && role !== 'editor') {
    return jsonError({
      source: request,
      namespace: 'admin.api.users',
      key: 'adminCanOnlyCreateEditor',
      code: 'FORBIDDEN',
      status: 403,
    })
  }
  if (role === 'owner') {
    return jsonError({
      source: request,
      namespace: 'admin.api.users',
      key: 'ownerRoleCreationForbidden',
      code: 'FORBIDDEN',
      status: 403,
    })
  }

  const newUser = await createUser({ username, password, email: email ?? undefined, role })
  await logActivity(request, guard.user.id, 'create_user')
  return jsonSuccess({ id: newUser.id, username: newUser.username, role: newUser.role })
}
