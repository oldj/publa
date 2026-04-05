import { requireRole } from '@/server/auth'
import { safeParseJson } from '@/server/lib/request'
import { getAllSettings, updateSettings } from '@/server/services/settings'
import { createStorageProvider } from '@/server/storage'
import { NextRequest, NextResponse } from 'next/server'

// 存储相关的 settings 键
const STORAGE_KEYS = [
  'storageProvider',
  'storageS3Endpoint',
  'storageS3Region',
  'storageS3Bucket',
  'storageS3AccessKey',
  'storageS3SecretKey',
  'storageOssRegion',
  'storageOssBucket',
  'storageOssAccessKeyId',
  'storageOssAccessKeySecret',
  'storageCosRegion',
  'storageCosBucket',
  'storageCosSecretId',
  'storageCosSecretKey',
  'storageR2AccountId',
  'storageR2Bucket',
  'storageR2AccessKey',
  'storageR2SecretKey',
  'attachmentBaseUrl',
]

/** 脱敏处理：只显示前 4 位和后 4 位，短密钥使用不可碰撞的占位符 */
const MASKED_PLACEHOLDER = '\x00MASKED\x00'
function maskSecret(value: string | undefined): string {
  if (!value) return ''
  if (value.length <= 8) return MASKED_PLACEHOLDER
  return value.slice(0, 4) + '****' + value.slice(-4)
}

/** 获取存储配置（脱敏） */
export async function GET() {
  const guard = await requireRole(['owner', 'admin'], '权限不足')
  if (!guard.ok) return guard.response

  const all = await getAllSettings()
  const config: Record<string, string> = {}
  for (const key of STORAGE_KEYS) {
    config[key] = all[key] || ''
  }

  // 脱敏密钥
  config.storageS3SecretKey = maskSecret(all.storageS3SecretKey)
  config.storageOssAccessKeySecret = maskSecret(all.storageOssAccessKeySecret)
  config.storageCosSecretKey = maskSecret(all.storageCosSecretKey)
  config.storageR2SecretKey = maskSecret(all.storageR2SecretKey)

  return NextResponse.json({ success: true, data: config })
}

/** 更新存储配置 */
export async function PUT(request: NextRequest) {
  const guard = await requireRole(['owner', 'admin'], '权限不足')
  if (!guard.ok) return guard.response

  const { data: body, error } = await safeParseJson(request)
  if (error) return error
  const all = await getAllSettings()
  const updates: Record<string, string> = {}

  // 密钥字段：如果提交值与当前脱敏值完全相同，说明用户未修改，跳过更新
  const SECRET_FIELDS: Record<string, string> = {
    storageS3SecretKey: 'storageS3SecretKey',
    storageOssAccessKeySecret: 'storageOssAccessKeySecret',
    storageCosSecretKey: 'storageCosSecretKey',
    storageR2SecretKey: 'storageR2SecretKey',
  }

  for (const key of STORAGE_KEYS) {
    if (body[key] !== undefined) {
      if (key in SECRET_FIELDS && body[key] === maskSecret(all[key])) {
        continue
      }
      updates[key] = body[key]
    }
  }

  await updateSettings(updates)
  return NextResponse.json({ success: true })
}

/** 测试连接 */
export async function POST(request: NextRequest) {
  const guard = await requireRole(['owner', 'admin'], '权限不足')
  if (!guard.ok) return guard.response

  const { data: body, error } = await safeParseJson(request)
  if (error) return error
  const { provider, ...config } = body

  // 如果密钥是脱敏值（与当前脱敏结果完全相同），从 settings 读取真实值
  const all = await getAllSettings()
  if (provider === 's3' && config.secretKey === maskSecret(all.storageS3SecretKey)) {
    config.secretKey = all.storageS3SecretKey || ''
  }
  if (provider === 'r2' && config.secretKey === maskSecret(all.storageR2SecretKey)) {
    config.secretKey = all.storageR2SecretKey || ''
  }
  if (provider === 'oss' && config.accessKeySecret === maskSecret(all.storageOssAccessKeySecret)) {
    config.accessKeySecret = all.storageOssAccessKeySecret || ''
  }
  if (provider === 'cos' && config.secretKey === maskSecret(all.storageCosSecretKey)) {
    config.secretKey = all.storageCosSecretKey || ''
  }

  const storage = await createStorageProvider(provider, config)
  if (!storage) {
    return NextResponse.json(
      { success: false, code: 'VALIDATION_ERROR', message: '配置不完整' },
      { status: 400 },
    )
  }

  const result = await storage.testConnection()
  if (!result.success) {
    return NextResponse.json(
      { success: false, code: 'CONNECTION_FAILED', message: result.message },
      { status: 400 },
    )
  }
  return NextResponse.json({ success: true })
}
