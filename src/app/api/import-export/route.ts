import { requireRole } from '@/server/auth'
import { logActivity } from '@/server/services/activity-logs'
import {
  exportContentData,
  exportSettingsData,
  importContentData,
  importSettingsData,
  validateImportData,
} from '@/server/services/import-export'
import { NextRequest, NextResponse } from 'next/server'

function formatTimestamp() {
  const now = new Date()
  const date = now.toISOString().substring(0, 10)
  const time = now.toISOString().substring(11, 19).replace(/:/g, '')
  return `${date}-${time}`
}

function getImportErrorMessage(error: unknown) {
  if (error instanceof Error && error.message) {
    return `导入失败：${error.message}`
  }
  return '导入失败，请检查数据完整性和关联关系'
}

/** 导出数据 */
export async function GET(request: NextRequest) {
  const guard = await requireRole(['owner', 'admin'], '仅站长和管理员可导出数据')
  if (!guard.ok) return guard.response

  const type = request.nextUrl.searchParams.get('type') || 'content'
  const ts = formatTimestamp()

  if (type === 'settings') {
    const data = await exportSettingsData()
    await logActivity(request, guard.user.id, 'export_data')
    return new NextResponse(JSON.stringify(data, null, 2), {
      headers: {
        'Content-Type': 'application/json',
        'Content-Disposition': `attachment; filename="publa-settings-${ts}.json"`,
      },
    })
  }

  const data = await exportContentData()
  await logActivity(request, guard.user.id, 'export_data')
  return new NextResponse(JSON.stringify(data, null, 2), {
    headers: {
      'Content-Type': 'application/json',
      'Content-Disposition': `attachment; filename="publa-content-${ts}.json"`,
    },
  })
}

/** 导入数据 */
export async function POST(request: NextRequest) {
  const guard = await requireRole(['owner', 'admin'], '仅站长和管理员可导入数据')
  if (!guard.ok) return guard.response

  let data: any
  try {
    data = await request.json()
  } catch {
    return NextResponse.json(
      { success: false, code: 'INVALID_FORMAT', message: '解析 JSON 失败' },
      { status: 400 },
    )
  }

  const validation = validateImportData(data)
  if (!validation.valid) {
    return NextResponse.json(
      { success: false, code: 'VALIDATION_ERROR', message: validation.message },
      { status: 400 },
    )
  }

  try {
    let results: string[]
    if (validation.type === 'content') {
      results = await importContentData(data, guard.user.id)
    } else {
      results = await importSettingsData(data, guard.user.id)
    }

    await logActivity(request, guard.user.id, 'import_data')
    return NextResponse.json({ success: true, data: { results } })
  } catch (error) {
    return NextResponse.json(
      { success: false, code: 'IMPORT_FAILED', message: getImportErrorMessage(error) },
      { status: 400 },
    )
  }
}
