import { requireRecentReauth, requireRole } from '@/server/auth'
import { jsonError, jsonSuccess } from '@/server/lib/api-response'
import { safeParseJson } from '@/server/lib/request'
import { jsonSettingsValidationError } from '@/server/lib/settings-error'
import {
  getAllSettings,
  isSettingsValidationError,
  normalizeSettingsPayload,
  STORAGE_SETTINGS_KEYS,
  updateSettings,
} from '@/server/services/settings'
import { createStorageProvider } from '@/server/storage'
import { NextRequest } from 'next/server'

/** 脱敏处理：只显示前 4 位和后 4 位，短密钥使用不可碰撞的占位符 */
const MASKED_PLACEHOLDER = '\x00MASKED\x00'
function maskSecret(value: string | undefined): string {
  if (!value) return ''
  if (value.length <= 8) return MASKED_PLACEHOLDER
  return value.slice(0, 4) + '****' + value.slice(-4)
}

/** 获取存储配置（脱敏） */
export async function GET() {
  const guard = await requireRole(['owner', 'admin'], {
    namespace: 'common.api',
    key: 'forbidden',
  })
  if (!guard.ok) return guard.response

  const all = await getAllSettings()
  const config: Record<string, string> = {}
  for (const key of STORAGE_SETTINGS_KEYS) {
    config[key] = String(all[key] ?? '')
  }

  // 脱敏密钥
  config.storageS3SecretKey = maskSecret(String(all.storageS3SecretKey ?? ''))
  config.storageOssAccessKeySecret = maskSecret(String(all.storageOssAccessKeySecret ?? ''))
  config.storageCosSecretKey = maskSecret(String(all.storageCosSecretKey ?? ''))
  config.storageR2SecretKey = maskSecret(String(all.storageR2SecretKey ?? ''))

  return jsonSuccess(config)
}

/** 更新存储配置 */
export async function PUT(request: NextRequest) {
  const guard = await requireRole(['owner', 'admin'], {
    namespace: 'common.api',
    key: 'forbidden',
  })
  if (!guard.ok) return guard.response
  const reauth = await requireRecentReauth(guard.user, request)
  if (!reauth.ok) return reauth.response

  const { data: body, error } = await safeParseJson(request)
  if (error) return error
  const all = await getAllSettings()
  const updates: Record<string, unknown> = {}

  // 密钥字段：如果提交值与当前脱敏值完全相同，说明用户未修改，跳过更新
  const SECRET_FIELDS: Record<string, string> = {
    storageS3SecretKey: 'storageS3SecretKey',
    storageOssAccessKeySecret: 'storageOssAccessKeySecret',
    storageCosSecretKey: 'storageCosSecretKey',
    storageR2SecretKey: 'storageR2SecretKey',
  }

  for (const key of STORAGE_SETTINGS_KEYS) {
    if ((body as Record<string, unknown>)[key] !== undefined) {
      if (key in SECRET_FIELDS && body[key] === maskSecret(String(all[key] ?? ''))) {
        continue
      }
      updates[key] = body[key]
    }
  }

  try {
    const normalized = normalizeSettingsPayload(updates, STORAGE_SETTINGS_KEYS)
    await updateSettings(normalized)
  } catch (error) {
    if (isSettingsValidationError(error)) {
      return jsonSettingsValidationError(error, request)
    }
    throw error
  }

  return jsonSuccess()
}

/** 测试连接 */
export async function POST(request: NextRequest) {
  const guard = await requireRole(['owner', 'admin'], {
    namespace: 'common.api',
    key: 'forbidden',
  })
  if (!guard.ok) return guard.response
  const reauth = await requireRecentReauth(guard.user, request)
  if (!reauth.ok) return reauth.response

  const { data: body, error } = await safeParseJson(request)
  if (error) return error
  const { provider, ...config } = body

  // 如果密钥是脱敏值（与当前脱敏结果完全相同），从 settings 读取真实值
  const all = await getAllSettings()
  if (provider === 's3' && config.secretKey === maskSecret(String(all.storageS3SecretKey ?? ''))) {
    config.secretKey = String(all.storageS3SecretKey ?? '')
  }
  if (provider === 'r2' && config.secretKey === maskSecret(String(all.storageR2SecretKey ?? ''))) {
    config.secretKey = String(all.storageR2SecretKey ?? '')
  }
  if (
    provider === 'oss' &&
    config.accessKeySecret === maskSecret(String(all.storageOssAccessKeySecret ?? ''))
  ) {
    config.accessKeySecret = String(all.storageOssAccessKeySecret ?? '')
  }
  if (
    provider === 'cos' &&
    config.secretKey === maskSecret(String(all.storageCosSecretKey ?? ''))
  ) {
    config.secretKey = String(all.storageCosSecretKey ?? '')
  }

  const storage = await createStorageProvider(provider, config)
  if (!storage) {
    return jsonError({
      source: request,
      namespace: 'admin.api.attachments',
      key: 'configIncomplete',
      code: 'VALIDATION_ERROR',
      status: 400,
    })
  }

  const result = await storage.testConnection()
  if (!result.success) {
    return jsonError({
      source: request,
      namespace: 'admin.api.attachments',
      key: 'connectionFailed',
      code: 'CONNECTION_FAILED',
      status: 400,
    })
  }
  return jsonSuccess()
}
