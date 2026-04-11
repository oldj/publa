import { requireRole } from '@/server/auth'
import { MAX_ZIP_BYTES } from '@/server/lib/zip'
import { logActivity } from '@/server/services/activity-logs'
import { createTheme, importThemesFromZip } from '@/server/services/themes'
import { NextRequest, NextResponse } from 'next/server'

export const runtime = 'nodejs'

export async function POST(request: NextRequest) {
  const guard = await requireRole(['owner', 'admin'])
  if (!guard.ok) return guard.response

  const contentLength = Number(request.headers.get('content-length') || 0)
  if (contentLength > MAX_ZIP_BYTES) {
    return NextResponse.json(
      { success: false, code: 'FILE_TOO_LARGE', message: '文件过大' },
      { status: 413 },
    )
  }

  let formData: FormData
  try {
    formData = await request.formData()
  } catch {
    return NextResponse.json(
      { success: false, code: 'VALIDATION_ERROR', message: '解析文件失败' },
      { status: 400 },
    )
  }

  const file = formData.get('file')
  if (!(file instanceof File) || file.size === 0) {
    return NextResponse.json(
      { success: false, code: 'VALIDATION_ERROR', message: '请选择要导入的文件' },
      { status: 400 },
    )
  }

  if (file.size > MAX_ZIP_BYTES) {
    return NextResponse.json(
      { success: false, code: 'FILE_TOO_LARGE', message: '文件过大' },
      { status: 413 },
    )
  }

  const lower = file.name.toLowerCase()
  let imported = 0
  let skipped = 0

  try {
    if (lower.endsWith('.css')) {
      const text = await file.text()
      const name = file.name.replace(/\.css$/i, '').trim()
      if (!name) {
        return NextResponse.json(
          { success: false, code: 'VALIDATION_ERROR', message: '文件名无效' },
          { status: 400 },
        )
      }
      await createTheme({ name, css: text })
      imported = 1
    } else if (lower.endsWith('.zip')) {
      const buffer = new Uint8Array(await file.arrayBuffer())
      const result = await importThemesFromZip(buffer)
      imported = result.imported
      skipped = result.skipped
      if (imported === 0) {
        return NextResponse.json(
          {
            success: false,
            code: 'VALIDATION_ERROR',
            message: '压缩包中没有可导入的 .css 文件',
          },
          { status: 400 },
        )
      }
    } else {
      return NextResponse.json(
        {
          success: false,
          code: 'UNSUPPORTED_FILE_TYPE',
          message: '仅支持 .css 或 .zip 文件',
        },
        { status: 400 },
      )
    }
  } catch (err) {
    const code = err instanceof Error && err.message === 'ZIP_TOO_LARGE' ? 'FILE_TOO_LARGE' : 'IMPORT_FAILED'
    const message =
      err instanceof Error && err.message === 'ZIP_TOO_LARGE'
        ? '压缩包内容过大'
        : err instanceof Error && err.message === 'ZIP_INVALID'
          ? '压缩包损坏或格式不正确'
          : '导入失败'
    const status = code === 'FILE_TOO_LARGE' ? 413 : 400
    return NextResponse.json({ success: false, code, message }, { status })
  }

  await logActivity(request, guard.user.id, 'import_themes')
  return NextResponse.json({ success: true, data: { imported, skipped } })
}
