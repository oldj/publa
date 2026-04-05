import { getCurrentUser } from '@/server/auth'
import { renderMarkdown } from '@/server/lib/markdown'
import { isUniqueConstraintError, safeParseJson } from '@/server/lib/request'
import {
  createPage,
  isPagePathAvailable,
  listPages,
  validatePagePath,
} from '@/server/services/pages'
import { NextRequest, NextResponse } from 'next/server'

export async function GET(request: NextRequest) {
  const user = await getCurrentUser()
  if (!user) {
    return NextResponse.json(
      { success: false, code: 'UNAUTHORIZED', message: 'Unauthorized' },
      { status: 401 },
    )
  }

  const result = await listPages()
  return NextResponse.json({ success: true, data: result })
}

export async function POST(request: NextRequest) {
  const user = await getCurrentUser()
  if (!user) {
    return NextResponse.json(
      { success: false, code: 'UNAUTHORIZED', message: 'Unauthorized' },
      { status: 401 },
    )
  }

  const { data: body, error } = await safeParseJson(request)
  if (error) return error
  if (!body.title || !body.path) {
    return NextResponse.json(
      { success: false, code: 'VALIDATION_ERROR', message: '标题和路径不能为空' },
      { status: 400 },
    )
  }

  const pathCheck = validatePagePath(body.path)
  if (!pathCheck.valid) {
    return NextResponse.json(
      { success: false, code: 'INVALID_PATH', message: pathCheck.message },
      { status: 400 },
    )
  }

  const pathAvailable = await isPagePathAvailable(body.path)
  if (!pathAvailable) {
    return NextResponse.json(
      { success: false, code: 'DUPLICATE_PATH', message: '该路径已被使用' },
      { status: 400 },
    )
  }

  // 根据内容类型处理
  const ct = body.contentType || 'richtext'
  body.contentType = ct
  if (body.contentRaw) {
    if (ct === 'markdown') {
      body.contentHtml = await renderMarkdown(body.contentRaw)
    } else {
      body.contentHtml = body.contentHtml || body.contentRaw
    }
  }

  try {
    const page = await createPage(body)
    return NextResponse.json({ success: true, data: page })
  } catch (err) {
    if (isUniqueConstraintError(err)) {
      return NextResponse.json(
        { success: false, code: 'DUPLICATE_PATH', message: '该路径已被使用' },
        { status: 400 },
      )
    }
    throw err
  }
}
