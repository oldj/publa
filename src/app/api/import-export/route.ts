import { getServerTranslator } from '@/i18n/server'
import { requireRecentReauth, requireRole } from '@/server/auth'
import { jsonError, jsonSuccess } from '@/server/lib/api-response'
import { logActivity } from '@/server/services/activity-logs'
import {
  exportContentData,
  exportSettingsData,
  importContentData,
  importSettingsData,
  validateImportData,
} from '@/server/services/import-export'
import { getSetting } from '@/server/services/settings'
import { NextRequest, NextResponse } from 'next/server'

function formatTimestamp() {
  const now = new Date()
  const date = now.toISOString().substring(0, 10)
  const time = now.toISOString().substring(11, 19).replace(/:/g, '')
  return `${date}-${time}`
}

/** 获取文件名前缀：优先使用站点标题，回退到 "publa" */
async function getFilenamePrefix(): Promise<string> {
  const title = await getSetting('siteTitle')
  if (typeof title === 'string' && title.trim()) {
    return title.trim().replace(/[<>:"/\\|?*\s]+/g, '_')
  }
  return 'publa'
}

/** 构建 Content-Disposition，用 RFC 5987 的 filename* 支持非 ASCII 文件名 */
function contentDisposition(filename: string): string {
  const encoded = encodeURIComponent(filename)
  return `attachment; filename="${encoded}"; filename*=UTF-8''${encoded}`
}

function isSettingsType(type: string) {
  return type === 'settings'
}

function canManageSettingsData(user: { role: string }) {
  return user.role === 'owner'
}

function forbiddenSettingsDataResponse(request: NextRequest) {
  return jsonError({
    source: request,
    namespace: 'common.api',
    key: 'forbidden',
    code: 'FORBIDDEN',
    status: 403,
  })
}

/** 导出数据 */
export async function GET(request: NextRequest) {
  const guard = await requireRole(['owner', 'admin'], {
    namespace: 'common.api',
    key: 'forbidden',
  })
  if (!guard.ok) return guard.response

  const type = request.nextUrl.searchParams.get('type') || 'content'
  if (isSettingsType(type) && !canManageSettingsData(guard.user)) {
    return forbiddenSettingsDataResponse(request)
  }

  // 仅 settings 导出包含用户、跳转、菜单等敏感配置，需要二次验证；
  // content 导出仅是后台可见内容的备份，admin 在 UI 里本就能读，无需额外密码确认。
  if (isSettingsType(type)) {
    const reauth = await requireRecentReauth(guard.user, request)
    if (!reauth.ok) return reauth.response
  }

  const ts = formatTimestamp()
  const prefix = await getFilenamePrefix()

  if (isSettingsType(type)) {
    const data = await exportSettingsData()
    await logActivity(request, guard.user.id, 'export_data')
    return new NextResponse(JSON.stringify(data, null, 2), {
      headers: {
        'Content-Type': 'application/json',
        'Content-Disposition': contentDisposition(`${prefix}-settings-${ts}.json`),
      },
    })
  }

  const data = await exportContentData()
  await logActivity(request, guard.user.id, 'export_data')
  return new NextResponse(JSON.stringify(data, null, 2), {
    headers: {
      'Content-Type': 'application/json',
      'Content-Disposition': contentDisposition(`${prefix}-content-${ts}.json`),
    },
  })
}

/** 导入数据 */
export async function POST(request: NextRequest) {
  const guard = await requireRole(['owner', 'admin'], {
    namespace: 'common.api',
    key: 'forbidden',
  })
  if (!guard.ok) return guard.response

  let data: any
  try {
    data = await request.json()
  } catch {
    return jsonError({
      source: request,
      namespace: 'admin.api.importExport',
      key: 'invalidJson',
      code: 'INVALID_FORMAT',
      status: 400,
    })
  }

  if (data?.meta?.type === 'settings' && !canManageSettingsData(guard.user)) {
    return forbiddenSettingsDataResponse(request)
  }

  const validation = validateImportData(data)
  if (!validation.valid) {
    const keyMap = {
      META_REQUIRED: 'metaRequired',
      UNSUPPORTED_VERSION: 'unsupportedVersion',
      MISSING_FIELD: 'missingField',
      INVALID_FIELD_FORMAT: 'invalidFieldFormat',
      UNKNOWN_TYPE: 'unknownType',
    } as const

    return jsonError({
      source: request,
      namespace: 'admin.api.importExport',
      key: keyMap[validation.code],
      values: validation.values,
      code: 'VALIDATION_ERROR',
      status: 400,
    })
  }

  const reauth = await requireRecentReauth(guard.user, request)
  if (!reauth.ok) return reauth.response

  try {
    let results
    if (validation.type === 'content') {
      results = await importContentData(data, guard.user.id)
    } else {
      results = await importSettingsData(data, guard.user.id)
    }

    const { t } = await getServerTranslator('admin.importExportPage', { source: request })
    const translatedResults = results.map((item) => t(`results.${item.key}`, item.values))

    await logActivity(request, guard.user.id, 'import_data')
    return jsonSuccess({ results: translatedResults })
  } catch (error) {
    console.error('[import-export] Failed to import data:', error)
    return jsonError({
      source: request,
      namespace: 'admin.api.importExport',
      key: 'importFailedFallback',
      code: 'IMPORT_FAILED',
      status: 400,
    })
  }
}
