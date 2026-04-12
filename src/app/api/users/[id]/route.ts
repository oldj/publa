import { requireCurrentUser } from '@/server/auth'
import { normalizeEmail, normalizePassword, normalizeUsername } from '@/lib/user-input'
import { jsonError, jsonSuccess } from '@/server/lib/api-response'
import { parseIdParam, safeParseJson } from '@/server/lib/request'
import { deleteUser, getUserById, updateUser } from '@/server/services/users'
import { logActivity } from '@/server/services/activity-logs'
import { NextRequest } from 'next/server'

type PermissionResult =
  | { allowed: true; target: NonNullable<Awaited<ReturnType<typeof getUserById>>> }
  | { allowed: false; status: 403 | 404; code: 'FORBIDDEN' | 'NOT_FOUND' }

/** 检查当前用户是否有权操作目标用户 */
async function checkPermission(
  currentUser: { id: number; role: string },
  targetId: number,
): Promise<PermissionResult> {
  const target = await getUserById(targetId)
  if (!target) return { allowed: false, status: 404, code: 'NOT_FOUND' }

  // 站长可操作所有用户
  if (currentUser.role === 'owner') {
    return { allowed: true, target }
  }

  // 管理员只能操作编辑
  if (currentUser.role === 'admin') {
    if (target.role !== 'editor') {
      return { allowed: false, status: 403, code: 'FORBIDDEN' }
    }
    return { allowed: true, target }
  }

  // 编辑只能操作自己
  if (currentUser.role === 'editor' && targetId === currentUser.id) {
    return { allowed: true, target }
  }

  return { allowed: false, status: 403, code: 'FORBIDDEN' }
}

export async function GET(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const guard = await requireCurrentUser()
  if (!guard.ok) return guard.response

  const { id: idStr } = await params
  const { id: targetId, error: idError } = await parseIdParam(idStr)
  if (idError) return idError

  // 编辑只能查看自己
  if (guard.user.role === 'editor' && targetId !== guard.user.id) {
    return jsonError({
      namespace: 'admin.api.users',
      key: 'forbidden',
      code: 'FORBIDDEN',
      status: 403,
    })
  }

  const target = await getUserById(targetId)
  if (!target) {
    return jsonError({
      namespace: 'admin.api.users',
      key: 'notFound',
      code: 'NOT_FOUND',
      status: 404,
    })
  }

  return jsonSuccess(target)
}

export async function PUT(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const guard = await requireCurrentUser()
  if (!guard.ok) return guard.response

  const { id: idStr } = await params
  const { id: targetId, error: idError } = await parseIdParam(idStr)
  if (idError) return idError
  const check = await checkPermission(guard.user, targetId)
  if (!check.allowed) {
    return jsonError({
      source: request,
      namespace: 'admin.api.users',
      key: check.code === 'NOT_FOUND' ? 'notFound' : 'forbidden',
      code: check.code,
      status: check.status,
    })
  }

  const { data: body, error } = await safeParseJson(request)
  if (error) return error
  const updateData: Record<string, string> = {}

  if (body?.username !== undefined) {
    const username = normalizeUsername(body.username)
    if (!username) {
      return jsonError({
        source: request,
        namespace: 'admin.api.users',
        key: 'usernameRequired',
        code: 'VALIDATION_ERROR',
        status: 400,
      })
    }
    updateData.username = username
  }

  if (body?.email !== undefined) {
    updateData.email = normalizeEmail(body.email) || ''
  }

  if (body?.password !== undefined) {
    const password = normalizePassword(body.password)
    if (!password) {
      return jsonError({
        source: request,
        namespace: 'admin.api.users',
        key: 'passwordRequired',
        code: 'VALIDATION_ERROR',
        status: 400,
      })
    }
    updateData.password = password
  }

  // 仅站长可修改角色，且不能修改自己的角色
  if (body.role && guard.user.role === 'owner' && targetId !== guard.user.id) {
    const validRoles = ['owner', 'admin', 'editor']
    if (!validRoles.includes(body.role)) {
      return jsonError({
        source: request,
        namespace: 'admin.api.users',
        key: 'invalidRole',
        code: 'VALIDATION_ERROR',
        status: 400,
      })
    }
    updateData.role = body.role
  }
  const updated = await updateUser(targetId, updateData)
  await logActivity(request, guard.user.id, 'update_user')
  return jsonSuccess(updated)
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const guard = await requireCurrentUser()
  if (!guard.ok) return guard.response

  const { id: idStr } = await params
  const { id: targetId, error: idError } = await parseIdParam(idStr)
  if (idError) return idError
  const check = await checkPermission(guard.user, targetId)
  if (!check.allowed) {
    return jsonError({
      source: request,
      namespace: 'admin.api.users',
      key: check.code === 'NOT_FOUND' ? 'notFound' : 'forbidden',
      code: check.code,
      status: check.status,
    })
  }

  const result = await deleteUser(targetId, guard.user.id)
  if (!result.success) {
    return jsonError({
      source: request,
      namespace: 'admin.api.users',
      key: result.code === 'CANNOT_DELETE_SELF' ? 'cannotDeleteSelf' : 'notFound',
      code: result.code === 'CANNOT_DELETE_SELF' ? 'OPERATION_FAILED' : 'NOT_FOUND',
      status: result.code === 'CANNOT_DELETE_SELF' ? 400 : 404,
    })
  }
  await logActivity(request, guard.user.id, 'delete_user')
  return jsonSuccess()
}
