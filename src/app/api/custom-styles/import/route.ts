import { requireRole } from '@/server/auth'
import { jsonError, jsonSuccess } from '@/server/lib/api-response'
import { MAX_ZIP_BYTES } from '@/server/lib/zip'
import { logActivity } from '@/server/services/activity-logs'
import { createCustomStyle, importCustomStylesFromZip } from '@/server/services/custom-styles'
import { NextRequest } from 'next/server'

export const runtime = 'nodejs'

export async function POST(request: NextRequest) {
  const guard = await requireRole(['owner', 'admin'])
  if (!guard.ok) return guard.response

  const contentLength = Number(request.headers.get('content-length') || 0)
  if (contentLength > MAX_ZIP_BYTES) {
    return jsonError({
      source: request,
      namespace: 'admin.api.customStyles',
      key: 'importFileTooLarge',
      code: 'FILE_TOO_LARGE',
      status: 413,
    })
  }

  let formData: FormData
  try {
    formData = await request.formData()
  } catch {
    return jsonError({
      source: request,
      namespace: 'admin.api.customStyles',
      key: 'importParseFailed',
      code: 'VALIDATION_ERROR',
      status: 400,
    })
  }

  const file = formData.get('file')
  if (!(file instanceof File) || file.size === 0) {
    return jsonError({
      source: request,
      namespace: 'admin.api.customStyles',
      key: 'importFileRequired',
      code: 'VALIDATION_ERROR',
      status: 400,
    })
  }

  if (file.size > MAX_ZIP_BYTES) {
    return jsonError({
      source: request,
      namespace: 'admin.api.customStyles',
      key: 'importFileTooLarge',
      code: 'FILE_TOO_LARGE',
      status: 413,
    })
  }

  const lower = file.name.toLowerCase()
  let imported = 0
  let skipped = 0

  try {
    if (lower.endsWith('.css')) {
      const text = await file.text()
      const name = file.name.replace(/\.css$/i, '').trim()
      if (!name) {
        return jsonError({
          source: request,
          namespace: 'admin.api.customStyles',
          key: 'importFilenameInvalid',
          code: 'VALIDATION_ERROR',
          status: 400,
        })
      }
      await createCustomStyle({ name, css: text })
      imported = 1
    } else if (lower.endsWith('.zip')) {
      const buffer = new Uint8Array(await file.arrayBuffer())
      const result = await importCustomStylesFromZip(buffer)
      imported = result.imported
      skipped = result.skipped
      if (imported === 0) {
        return jsonError({
          source: request,
          namespace: 'admin.api.customStyles',
          key: 'importZipEmpty',
          code: 'VALIDATION_ERROR',
          status: 400,
        })
      }
    } else {
      return jsonError({
        source: request,
        namespace: 'admin.api.customStyles',
        key: 'importUnsupportedFileType',
        code: 'UNSUPPORTED_FILE_TYPE',
        status: 400,
      })
    }
  } catch (err) {
    const rawMessage = err instanceof Error ? err.message : ''
    if (rawMessage === 'ZIP_TOO_LARGE') {
      return jsonError({
        source: request,
        namespace: 'admin.api.customStyles',
        key: 'importZipTooLarge',
        code: 'FILE_TOO_LARGE',
        status: 413,
      })
    }
    if (rawMessage === 'ZIP_INVALID') {
      return jsonError({
        source: request,
        namespace: 'admin.api.customStyles',
        key: 'importZipInvalid',
        code: 'ZIP_INVALID',
        status: 400,
      })
    }
    return jsonError({
      source: request,
      namespace: 'admin.api.customStyles',
      key: 'importFailed',
      code: 'IMPORT_FAILED',
      status: 400,
    })
  }

  await logActivity(request, guard.user.id, 'import_custom_styles')
  return jsonSuccess({ imported, skipped })
}
