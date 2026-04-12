import { requireRole } from '@/server/auth'
import { jsonError, jsonSuccess } from '@/server/lib/api-response'
import { safeParseJson } from '@/server/lib/request'
import { logActivity } from '@/server/services/activity-logs'
import {
  createRedirectRule,
  listRedirectRules,
  RedirectRuleValidationError,
  reorderRedirectRules,
} from '@/server/services/redirect-rules'
import { NextRequest } from 'next/server'
import { validationErrorResponse } from './shared'

export async function GET() {
  const guard = await requireRole(['owner', 'admin'])
  if (!guard.ok) return guard.response

  const data = await listRedirectRules()
  return jsonSuccess(data)
}

export async function POST(request: NextRequest) {
  const guard = await requireRole(['owner', 'admin'])
  if (!guard.ok) return guard.response

  const { data: body, error } = await safeParseJson(request)
  if (error) return error

  try {
    if (body.action === 'reorder') {
      if (!Array.isArray(body.ids)) {
        return jsonError({
          source: request,
          namespace: 'admin.api.redirectRules',
          key: 'invalidReorder',
          code: 'VALIDATION_ERROR',
          status: 400,
        })
      }

      await reorderRedirectRules(body.ids)
      return jsonSuccess()
    }

    const item = await createRedirectRule({
      pathRegex: body.pathRegex,
      redirectTo: body.redirectTo,
      redirectType: body.redirectType,
      memo: body.memo,
    })
    await logActivity(request, guard.user.id, 'create_redirect')
    return jsonSuccess(item)
  } catch (caughtError) {
    if (caughtError instanceof RedirectRuleValidationError) {
      return validationErrorResponse(caughtError, request)
    }
    throw caughtError
  }
}
