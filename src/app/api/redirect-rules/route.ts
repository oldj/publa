import { requireRole } from '@/server/auth'
import { safeParseJson } from '@/server/lib/request'
import { logActivity } from '@/server/services/activity-logs'
import {
  createRedirectRule,
  listRedirectRules,
  RedirectRuleValidationError,
  reorderRedirectRules,
} from '@/server/services/redirect-rules'
import { NextRequest, NextResponse } from 'next/server'
import { validationErrorResponse } from './shared'

export async function GET() {
  const guard = await requireRole(['owner', 'admin'])
  if (!guard.ok) return guard.response

  const data = await listRedirectRules()
  return NextResponse.json({ success: true, data })
}

export async function POST(request: NextRequest) {
  const guard = await requireRole(['owner', 'admin'])
  if (!guard.ok) return guard.response

  const { data: body, error } = await safeParseJson(request)
  if (error) return error

  try {
    if (body.action === 'reorder') {
      if (!Array.isArray(body.ids)) {
        return NextResponse.json(
          {
            success: false,
            code: 'VALIDATION_ERROR',
            message: '排序数据无效',
          },
          { status: 400 },
        )
      }

      await reorderRedirectRules(body.ids)
      return NextResponse.json({ success: true })
    }

    const item = await createRedirectRule({
      pathRegex: body.pathRegex,
      redirectTo: body.redirectTo,
      redirectType: body.redirectType,
      memo: body.memo,
    })
    logActivity(request, guard.user.id, 'create_redirect')
    return NextResponse.json({ success: true, data: item })
  } catch (caughtError) {
    if (caughtError instanceof RedirectRuleValidationError) {
      return validationErrorResponse(caughtError)
    }
    throw caughtError
  }
}
