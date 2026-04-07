import { getCurrentUser } from '@/server/auth'
import { db } from '@/server/db'
import { renderMarkdown, htmlToText } from '@/server/lib/markdown'
import { isUniqueConstraintError, parseIdParam, safeParseJson } from '@/server/lib/request'
import {
  deletePage,
  getPageById,
  isPagePathAvailable,
  updatePage,
  validatePagePath,
} from '@/server/services/pages'
import { getDraft, publishDraft, saveDraft } from '@/server/services/revisions'
import { parsePageDraftMetadata } from '@/shared/revision-metadata'
import { logActivity } from '@/server/services/activity-logs'
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
            ...parsePageDraftMetadata(draft.metadata),
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

  // 发布/定时发布时校验必填字段
  if (body.status === 'published' || body.status === 'scheduled') {
    if (!body.title) {
      return NextResponse.json(
        { success: false, code: 'VALIDATION_ERROR', message: '发布时标题不能为空' },
        { status: 400 },
      )
    }
    if (!body.path) {
      return NextResponse.json(
        { success: false, code: 'VALIDATION_ERROR', message: '发布时路径不能为空' },
        { status: 400 },
      )
    }
  }

  // 定时发布必须提供发布时间
  if (body.status === 'scheduled' && !body.publishedAt) {
    return NextResponse.json(
      { success: false, code: 'VALIDATION_ERROR', message: '定时发布必须指定发布时间' },
      { status: 400 },
    )
  }

  // 校验路径（如果提供了路径）
  if (body.path) {
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

  // 根据内容类型处理
  const ct = body.contentType || 'richtext'
  body.contentType = ct
  if (body.contentRaw !== undefined) {
    if (ct === 'markdown') {
      body.contentHtml = await renderMarkdown(body.contentRaw)
      body.contentText = htmlToText(body.contentHtml)
    } else {
      body.contentHtml = body.contentHtml || body.contentRaw
      body.contentText = body.contentText || htmlToText(body.contentHtml)
    }
  }

  try {
    if (body.status === 'published' || body.status === 'scheduled') {
      // 发布/定时发布时将主表更新和版本冻结包进事务
      const page = await db.transaction(async (tx) => {
        const result = await updatePage(pageId, body, tx)
        if (!result) return null

        await saveDraft(
          'page',
          pageId,
          {
            title: body.title || result.title || '',
            excerpt: '',
            contentType: body.contentType,
            contentRaw: body.contentRaw || '',
            contentHtml: body.contentHtml || '',
            contentText: body.contentText || '',
            metadata: parsePageDraftMetadata({
              path: body.path,
              template: body.template,
              mimeType: body.mimeType,
              seoTitle: body.seoTitle,
              seoDescription: body.seoDescription,
              publishedAt: result.publishedAt,
            }),
          },
          user.id,
          tx,
        )
        await publishDraft('page', pageId, user.id, tx)

        return result
      })

      if (!page) {
        return NextResponse.json(
          { success: false, code: 'NOT_FOUND', message: '页面不存在' },
          { status: 404 },
        )
      }
      await logActivity(request, user.id, 'update_page')

      return NextResponse.json({ success: true, data: page })
    }

    // 非发布操作，直接更新主表
    const page = await updatePage(pageId, body)
    if (!page) {
      return NextResponse.json(
        { success: false, code: 'NOT_FOUND', message: '页面不存在' },
        { status: 404 },
      )
    }

    await logActivity(request, user.id, 'update_page')

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
  request: NextRequest,
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

  await logActivity(request, user.id, 'delete_page')

  return NextResponse.json({ success: true })
}
