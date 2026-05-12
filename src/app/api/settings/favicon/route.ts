import { requireRecentReauth, requireRole } from '@/server/auth'
import { jsonError, jsonSuccess } from '@/server/lib/api-response'
import { safeParseJson } from '@/server/lib/request'
import {
  getFaviconConfig,
  isFaviconError,
  resetFavicon,
  saveFaviconUrl,
  saveUploadedFavicon,
} from '@/server/services/favicon'
import { NextRequest } from 'next/server'

export const dynamic = 'force-dynamic'

function getErrorMessage(error: unknown): string {
  if (!isFaviconError(error)) return 'saveFailed'

  switch (error.code) {
    case 'EMPTY_FILE':
      return 'fileRequired'
    case 'FILE_TOO_LARGE':
      return 'fileTooLarge'
    case 'INVALID_FILE_TYPE':
      return 'invalidFileType'
    case 'INVALID_URL':
      return 'invalidUrl'
    default:
      return 'saveFailed'
  }
}

function createValidationErrorResponse(error: unknown, source?: Request) {
  return jsonError({
    source,
    namespace: 'admin.api.favicon',
    key: getErrorMessage(error),
    code: 'VALIDATION_ERROR',
    status: 400,
  })
}

export async function GET() {
  const guard = await requireRole(['owner', 'admin'])
  if (!guard.ok) return guard.response

  const data = await getFaviconConfig()
  return jsonSuccess(data)
}

export async function POST(request: NextRequest) {
  const guard = await requireRole(['owner', 'admin'])
  if (!guard.ok) return guard.response
  const reauth = await requireRecentReauth(guard.user, request)
  if (!reauth.ok) return reauth.response

  const formData = await request.formData()
  const file = formData.get('file')
  if (!(file instanceof File)) {
    return jsonError({
      source: request,
      namespace: 'admin.api.favicon',
      key: 'fileRequired',
      code: 'VALIDATION_ERROR',
      status: 400,
    })
  }

  try {
    const buffer = Buffer.from(await file.arrayBuffer())
    const data = await saveUploadedFavicon({
      buffer,
      originalFilename: file.name,
      mimeType: file.type,
    })
    return jsonSuccess(data)
  } catch (error) {
    if (isFaviconError(error)) return createValidationErrorResponse(error, request)
    throw error
  }
}

export async function PUT(request: NextRequest) {
  const guard = await requireRole(['owner', 'admin'])
  if (!guard.ok) return guard.response
  const reauth = await requireRecentReauth(guard.user, request)
  if (!reauth.ok) return reauth.response

  const { data: body, error } = await safeParseJson<{ url?: string }>(request)
  if (error) return error

  try {
    const data = await saveFaviconUrl(body.url || '')
    return jsonSuccess(data)
  } catch (routeError) {
    if (isFaviconError(routeError)) return createValidationErrorResponse(routeError, request)
    throw routeError
  }
}

export async function DELETE(request: NextRequest) {
  const guard = await requireRole(['owner', 'admin'])
  if (!guard.ok) return guard.response
  const reauth = await requireRecentReauth(guard.user, request)
  if (!reauth.ok) return reauth.response

  const data = await resetFavicon()
  return jsonSuccess(data)
}
