import { getCurrentUser } from '@/server/auth'
import { renderMarkdown } from '@/server/lib/markdown'
import { isUniqueConstraintError, parseIdParam, safeParseJson } from '@/server/lib/request'
import {
  deletePage,
  getPageById,
  isPagePathAvailable,
  updatePage,
  validatePagePath,
} from '@/server/services/pages'
import { getDraft, publishDraft } from '@/server/services/revisions'
import { NextRequest, NextResponse } from 'next/server'

export async function GET(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser()
  if (!user) {
    return NextResponse.json(
      { success: false, code: 'UNAUTHORIZED', message: 'Unauthorized' },
      { status: 401 },
    )
  }

  const { id: idStr } = await params
  const { id: pageId, error: idError } = parseIdParam(idStr)
  if (idError) return idError
  const page = await getPageById(pageId)
  if (!page) {
    return NextResponse.json(
      { success: false, code: 'NOT_FOUND', message: '页面不存在' },
      { status: 404 },
    )
  }

  // 附带草稿内容（如果有）
  const draft = await getDraft('page', page.id)
  return NextResponse.json({
    success: true,
    data: {
      ...page,
      draftContent: draft
        ? {
            title: draft.title,
            contentType: draft.contentType,
            contentRaw: draft.contentRaw,
            contentHtml: draft.contentHtml,
            updatedAt: draft.updatedAt,
          }
        : null,
    },
  })
}

export async function PUT(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser()
  if (!user) {
    return NextResponse.json(
      { success: false, code: 'UNAUTHORIZED', message: 'Unauthorized' },
      { status: 401 },
    )
  }

  const { id: idStr } = await params
  const { id: pageId, error: idError } = parseIdParam(idStr)
  if (idError) return idError
  const { data: body, error } = await safeParseJson(request)
  if (error) return error

  // 校验路径
  if (body.path !== undefined) {
    if (!body.path) {
      return NextResponse.json(
        { success: false, code: 'VALIDATION_ERROR', message: '路径不能为空' },
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
    const pathAvailable = await isPagePathAvailable(body.path, pageId)
    if (!pathAvailable) {
      return NextResponse.json(
        { success: false, code: 'DUPLICATE_PATH', message: '该路径已被使用' },
        { status: 400 },
      )
    }
  }

  if (!body.title) {
    return NextResponse.json(
      { success: false, code: 'VALIDATION_ERROR', message: '标题不能为空' },
      { status: 400 },
    )
  }

  // 根据内容类型处理
  const ct = body.contentType || 'richtext'
  body.contentType = ct
  if (body.contentRaw !== undefined) {
    if (ct === 'markdown') {
      body.contentHtml = await renderMarkdown(body.contentRaw)
    } else {
      body.contentHtml = body.contentHtml || body.contentRaw
    }
  }

  try {
    const page = await updatePage(pageId, body)
    if (!page) {
      return NextResponse.json(
        { success: false, code: 'NOT_FOUND', message: '页面不存在' },
        { status: 404 },
      )
    }

    // 发布时将草稿冻结为历史版本
    if (body.status === 'published') {
      await publishDraft('page', pageId)
    }

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

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const user = await getCurrentUser()
  if (!user) {
    return NextResponse.json(
      { success: false, code: 'UNAUTHORIZED', message: 'Unauthorized' },
      { status: 401 },
    )
  }

  const { id: idStr } = await params
  const { id: pageId, error: idError } = parseIdParam(idStr)
  if (idError) return idError
  await deletePage(pageId)
  return NextResponse.json({ success: true })
}
