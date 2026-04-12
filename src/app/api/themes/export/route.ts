import { requireRole } from '@/server/auth'
import { jsonError } from '@/server/lib/api-response'
import { safeParseJson } from '@/server/lib/request'
import { logActivity } from '@/server/services/activity-logs'
import { getSetting } from '@/server/services/settings'
import { exportThemesAsZip } from '@/server/services/themes'
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
  if (
    !ids ||
    ids.length === 0 ||
    !ids.every((id: unknown) => Number.isInteger(id) && (id as number) > 0)
  ) {
    return jsonError({
      source: request,
      namespace: 'admin.api.themes',
      key: 'exportSelectionRequired',
      code: 'VALIDATION_ERROR',
      status: 400,
    })
  }

  const buf = await exportThemesAsZip(ids as number[])
  if (buf.byteLength === 0) {
    return jsonError({
      source: request,
      namespace: 'admin.api.themes',
      key: 'exportEmpty',
      code: 'VALIDATION_ERROR',
      status: 400,
    })
  }

  await logActivity(request, guard.user.id, 'export_themes')

  const prefix = await getFilenamePrefix()
  const ts = formatTimestamp()
  return new NextResponse(buf, {
    headers: {
      'Content-Type': 'application/zip',
      'Content-Disposition': contentDisposition(`${prefix}-themes-${ts}.zip`),
    },
  })
}
