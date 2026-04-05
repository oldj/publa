import { requireRole } from '@/server/auth'
import { safeParseJson } from '@/server/lib/request'
import {
  getFaviconConfig,
  isFaviconError,
  resetFavicon,
  saveFaviconUrl,
  saveUploadedFavicon,
} from '@/server/services/favicon'
import { NextRequest, NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'

function getErrorMessage(error: unknown): string {
  if (!isFaviconError(error)) return '保存站点图标失败'

  switch (error.code) {
    case 'EMPTY_FILE':
      return '请选择图标文件'
    case 'FILE_TOO_LARGE':
      return '图标文件不能超过 256KB'
    case 'INVALID_FILE_TYPE':
      return '仅支持 ICO、PNG、SVG、WEBP 格式'
    case 'INVALID_URL':
      return '图标 URL 仅支持 https:// 地址'
    default:
      return '保存站点图标失败'
  }
}

function createValidationErrorResponse(error: unknown) {
  return NextResponse.json(
    {
      success: false,
      code: 'VALIDATION_ERROR',
      message: getErrorMessage(error),
    },
    { status: 400 },
  )
}

export async function GET() {
  const guard = await requireRole(['owner', 'admin'])
  if (!guard.ok) return guard.response

  const data = await getFaviconConfig()
  return NextResponse.json({ success: true, data })
}

export async function POST(request: NextRequest) {
  const guard = await requireRole(['owner', 'admin'])
  if (!guard.ok) return guard.response

  const formData = await request.formData()
  const file = formData.get('file')
  if (!(file instanceof File)) {
    return NextResponse.json(
      { success: false, code: 'VALIDATION_ERROR', message: '请选择图标文件' },
      { status: 400 },
    )
  }

  try {
    const buffer = Buffer.from(await file.arrayBuffer())
    const data = await saveUploadedFavicon({
      buffer,
      originalFilename: file.name,
      mimeType: file.type,
    })
    return NextResponse.json({ success: true, data })
  } catch (error) {
    if (isFaviconError(error)) return createValidationErrorResponse(error)
    throw error
  }
}

export async function PUT(request: NextRequest) {
  const guard = await requireRole(['owner', 'admin'])
  if (!guard.ok) return guard.response

  const { data: body, error } = await safeParseJson<{ url?: string }>(request)
  if (error) return error

  try {
    const data = await saveFaviconUrl(body.url || '')
    return NextResponse.json({ success: true, data })
  } catch (routeError) {
    if (isFaviconError(routeError)) return createValidationErrorResponse(routeError)
    throw routeError
  }
}

export async function DELETE() {
  const guard = await requireRole(['owner', 'admin'])
  if (!guard.ok) return guard.response

  const data = await resetFavicon()
  return NextResponse.json({ success: true, data })
}
