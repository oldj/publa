import { RedirectRuleValidationError } from '@/server/services/redirect-rules'
import { jsonError } from '@/server/lib/api-response'

function toValidationKey(error: RedirectRuleValidationError): string {
  switch (error.code) {
    case 'INVALID_PATH_REGEX':
      return 'invalidPathRegex'
    case 'INVALID_REDIRECT_TO':
      return 'invalidRedirectTo'
    case 'INVALID_REDIRECT_TYPE':
      return 'invalidRedirectType'
    case 'INVALID_REORDER_IDS':
      return 'invalidReorder'
    default:
      return 'invalidPayload'
  }
}

export function validationErrorResponse(error: RedirectRuleValidationError, source?: Request) {
  return jsonError({
    source,
    namespace: 'admin.api.redirectRules',
    key: toValidationKey(error),
    code: 'VALIDATION_ERROR',
    status: 400,
  })
}
