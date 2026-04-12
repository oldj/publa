import type { HeadersLike } from '@/i18n/resolve-locale'
import { jsonError } from '@/server/lib/api-response'
import { SettingsValidationError } from '@/server/services/settings'

type RequestLike = Request | HeadersLike

function extractKeys(message: string, prefix: string) {
  const index = message.indexOf(prefix)
  if (index < 0) return []
  return message
    .slice(index + prefix.length)
    .split(/[；;]/, 1)[0]
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean)
}

export async function jsonSettingsValidationError(
  error: SettingsValidationError,
  source?: RequestLike,
) {
  const invalidKeys =
    Array.isArray(error.invalidKeys) && error.invalidKeys.length > 0
      ? error.invalidKeys
      : extractKeys(error.message, '不支持修改以下设置项：')
  const invalidValueKeys =
    Array.isArray(error.invalidValueKeys) && error.invalidValueKeys.length > 0
      ? error.invalidValueKeys
      : extractKeys(error.message, '以下设置项的值类型不合法：')
  const reason =
    error.reason ??
    (invalidKeys.length > 0 && invalidValueKeys.length > 0
      ? 'INVALID_PAYLOAD'
      : invalidKeys.length > 0
        ? 'INVALID_KEYS'
        : invalidValueKeys.length > 0
          ? 'INVALID_VALUES'
          : error.message.includes('对象')
            ? 'INVALID_OBJECT'
            : 'INVALID_PAYLOAD')

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
