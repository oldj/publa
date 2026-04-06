import { requireRole } from '@/server/auth'
import { parseIdParam, safeParseJson } from '@/server/lib/request'
import { logActivity } from '@/server/services/activity-logs'
import {
  deleteRedirectRule,
  getRedirectRuleById,
  RedirectRuleValidationError,
  updateRedirectRule,
} from '@/server/services/redirect-rules'
import { NextRequest, NextResponse } from 'next/server'
import { validationErrorResponse } from '../shared'

export async function PUT(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const guard = await requireRole(['owner', 'admin'])
  if (!guard.ok) return guard.response

  const { id: idStr } = await params
  const { id, error: idError } = parseIdParam(idStr)
  if (idError) return idError

  const { data: body, error } = await safeParseJson(request)
  if (error) return error

  try {
    const item = await updateRedirectRule(id, {
      pathRegex: body.pathRegex,
      redirectTo: body.redirectTo,
      redirectType: body.redirectType,
      memo: body.memo,
    })

    if (!item) {
      return NextResponse.json(
        { success: false, code: 'NOT_FOUND', message: '跳转规则不存在' },
        { status: 404 },
      )
    }

    logActivity(request, guard.user.id, 'update_redirect')
    return NextResponse.json({ success: true, data: item })
  } catch (caughtError) {
    if (caughtError instanceof RedirectRuleValidationError) {
      return validationErrorResponse(caughtError)
    }
    throw caughtError
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const guard = await requireRole(['owner', 'admin'])
  if (!guard.ok) return guard.response

  const { id: idStr } = await params
  const { id, error: idError } = parseIdParam(idStr)
  if (idError) return idError

  const existing = await getRedirectRuleById(id)
  if (!existing) {
    return NextResponse.json(
      { success: false, code: 'NOT_FOUND', message: '跳转规则不存在' },
      { status: 404 },
    )
  }

  await deleteRedirectRule(id)
  logActivity(request, guard.user.id, 'delete_redirect')
  return NextResponse.json({ success: true })
}
