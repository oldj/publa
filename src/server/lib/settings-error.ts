import type { HeadersLike } from '@/i18n/resolve-locale'
import { jsonError } from '@/server/lib/api-response'
import { SettingsValidationError } from '@/server/services/settings'

type RequestLike = Request | HeadersLike

export async function jsonSettingsValidationError(
  error: SettingsValidationError,
  source?: RequestLike,
) {
  const invalidKeys = Array.isArray(error.invalidKeys) ? error.invalidKeys : []
  const invalidValueKeys = Array.isArray(error.invalidValueKeys) ? error.invalidValueKeys : []
  const reason = error.reason ?? 'INVALID_PAYLOAD'

  if (invalidKeys.length > 0 && invalidValueKeys.length > 0) {
    return jsonError({
      source,
      namespace: 'admin.api.settings',
      key: 'unsupportedAndInvalidValues',
      values: {
        invalidKeys: invalidKeys.join(', '),
        invalidValueKeys: invalidValueKeys.join(', '),
      },
      code: 'VALIDATION_ERROR',
      status: 400,
    })
  }

  if (invalidKeys.length > 0) {
    return jsonError({
      source,
      namespace: 'admin.api.settings',
      key: 'unsupportedKeys',
      values: {
        invalidKeys: invalidKeys.join(', '),
      },
      code: 'VALIDATION_ERROR',
      status: 400,
    })
  }

  if (invalidValueKeys.length > 0) {
    return jsonError({
      source,
      namespace: 'admin.api.settings',
      key: 'invalidValueKeys',
      values: {
        invalidValueKeys: invalidValueKeys.join(', '),
      },
      code: 'VALIDATION_ERROR',
      status: 400,
    })
  }

  return jsonError({
    source,
    namespace: 'admin.api.settings',
    key: reason === 'INVALID_OBJECT' ? 'invalidObject' : 'invalidPayload',
    code: 'VALIDATION_ERROR',
    status: 400,
  })
}
