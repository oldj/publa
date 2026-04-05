import { requireCurrentUser } from '@/server/auth'
import { normalizeEmail, normalizePassword, normalizeUsername } from '@/lib/user-input'
import { parseIdParam, safeParseJson } from '@/server/lib/request'
import { deleteUser, getUserById, updateUser } from '@/server/services/users'
import { NextRequest, NextResponse } from 'next/server'

/** 检查当前用户是否有权操作目标用户 */
async function checkPermission(currentUser: { id: number; role: string }, targetId: number) {
  const target = await getUserById(targetId)
  if (!target) return { allowed: false, status: 404, message: '用户不存在' }

  // 站长可操作所有用户
  if (currentUser.role === 'owner') {
    return { allowed: true, target }
  }

  // 管理员只能操作编辑
  if (currentUser.role === 'admin') {
    if (target.role !== 'editor') {
      return { allowed: false, status: 403, message: '权限不足' }
    }
    return { allowed: true, target }
  }

  // 编辑只能操作自己
  if (currentUser.role === 'editor' && targetId === currentUser.id) {
    return { allowed: true, target }
  }

  return { allowed: false, status: 403, message: '权限不足' }
}

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const guard = await requireCurrentUser()
  if (!guard.ok) return guard.response

  const { id: idStr } = await params
  const { id: targetId, error: idError } = parseIdParam(idStr)
  if (idError) return idError

  // 编辑只能查看自己
  if (guard.user.role === 'editor' && targetId !== guard.user.id) {
    return NextResponse.json(
      { success: false, code: 'FORBIDDEN', message: '权限不足' },
      { status: 403 },
    )
  }

  const target = await getUserById(targetId)
  if (!target) {
    return NextResponse.json(
      { success: false, code: 'NOT_FOUND', message: '用户不存在' },
      { status: 404 },
    )
  }

  return NextResponse.json({ success: true, data: target })
}

export async function PUT(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const guard = await requireCurrentUser()
  if (!guard.ok) return guard.response

  const { id: idStr } = await params
  const { id: targetId, error: idError } = parseIdParam(idStr)
  if (idError) return idError
  const check = await checkPermission(guard.user, targetId)
  if (!check.allowed) {
    return NextResponse.json(
      { success: false, code: 'FORBIDDEN', message: check.message },
      { status: check.status },
    )
  }

  const { data: body, error } = await safeParseJson(request)
  if (error) return error
  const updateData: Record<string, string> = {}

  if (body?.username !== undefined) {
    const username = normalizeUsername(body.username)
    if (!username) {
      return NextResponse.json(
        { success: false, code: 'VALIDATION_ERROR', message: '用户名不能为空' },
        { status: 400 },
      )
    }
    updateData.username = username
  }

  if (body?.email !== undefined) {
    updateData.email = normalizeEmail(body.email) || ''
  }

  if (body?.password !== undefined) {
    const password = normalizePassword(body.password)
    if (!password) {
      return NextResponse.json(
        { success: false, code: 'VALIDATION_ERROR', message: '密码不能为空' },
        { status: 400 },
      )
    }
    updateData.password = password
  }

  // 仅站长可修改角色，且不能修改自己的角色
  if (body.role && guard.user.role === 'owner' && targetId !== guard.user.id) {
    const validRoles = ['owner', 'admin', 'editor']
    if (!validRoles.includes(body.role)) {
      return NextResponse.json(
        { success: false, code: 'VALIDATION_ERROR', message: '无效的角色值' },
        { status: 400 },
      )
    }
    updateData.role = body.role
  }
  const updated = await updateUser(targetId, updateData)
  return NextResponse.json({ success: true, data: updated })
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const guard = await requireCurrentUser()
  if (!guard.ok) return guard.response

  const { id: idStr } = await params
  const { id: targetId, error: idError } = parseIdParam(idStr)
  if (idError) return idError
  const check = await checkPermission(guard.user, targetId)
  if (!check.allowed) {
    return NextResponse.json(
      { success: false, code: 'FORBIDDEN', message: check.message },
      { status: check.status },
    )
  }

  const result = await deleteUser(targetId, guard.user.id)
  if (!result.success) {
    return NextResponse.json(
      { success: false, code: 'OPERATION_FAILED', message: result.message },
      { status: 400 },
    )
  }
  return NextResponse.json({ success: true })
}
