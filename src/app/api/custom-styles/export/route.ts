import { requireRole } from '@/server/auth'
import { safeParseJson } from '@/server/lib/request'
import { logActivity } from '@/server/services/activity-logs'
import { exportCustomStylesAsZip } from '@/server/services/custom-styles'
import { getSetting } from '@/server/services/settings'
import { NextRequest, NextResponse } from 'next/server'

export const runtime = 'nodejs'

function formatTimestamp() {
  const now = new Date()
  const date = now.toISOString().substring(0, 10)
  const time = now.toISOString().substring(11, 19).replace(/:/g, '')
  return `${date}-${time}`
}

async function getFilenamePrefix(): Promise<string> {
  const title = await getSetting('siteTitle')
  if (typeof title === 'string' && title.trim()) {
    return title.trim().replace(/[<>:"/\\|?*\s]+/g, '_')
  }
  return 'publa'
}

function contentDisposition(filename: string): string {
  const encoded = encodeURIComponent(filename)
  return `attachment; filename="${encoded}"; filename*=UTF-8''${encoded}`
}

export async function POST(request: NextRequest) {
  const guard = await requireRole(['owner', 'admin'])
  if (!guard.ok) return guard.response

  const { data: body, error } = await safeParseJson(request)
  if (error) return error

  const ids = Array.isArray(body?.ids) ? body.ids : null
  if (!ids || ids.length === 0 || !ids.every((id: unknown) => Number.isInteger(id) && (id as number) > 0)) {
    return NextResponse.json(
      { success: false, code: 'VALIDATION_ERROR', message: '未指定要导出的自定义 CSS' },
      { status: 400 },
    )
  }

  const buf = await exportCustomStylesAsZip(ids as number[])
  if (buf.byteLength === 0) {
    return NextResponse.json(
      { success: false, code: 'VALIDATION_ERROR', message: '没有可导出的自定义 CSS' },
      { status: 400 },
    )
  }

  await logActivity(request, guard.user.id, 'export_custom_styles')

  const prefix = await getFilenamePrefix()
  const ts = formatTimestamp()
  // fflate 返回的 Uint8Array 的 backing 实际是新分配的 ArrayBuffer，但 TS 6 的 lib 把
  // 默认泛型放宽到 ArrayBufferLike（含 SharedArrayBuffer），与 BodyInit 不兼容，这里做一次断言。
  return new NextResponse(buf as unknown as BodyInit, {
    headers: {
      'Content-Type': 'application/zip',
      'Content-Disposition': contentDisposition(`${prefix}-custom-styles-${ts}.zip`),
    },
  })
}
