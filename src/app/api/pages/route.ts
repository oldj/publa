import { getCurrentUser } from '@/server/auth'
import { db } from '@/server/db'
import { renderMarkdown, htmlToText } from '@/server/lib/markdown'
import { isUniqueConstraintError, safeParseJson } from '@/server/lib/request'
import {
  createEmptyPage,
  createPage,
  isPagePathAvailable,
  listPages,
  validatePagePath,
} from '@/server/services/pages'
import { publishDraft, saveDraft } from '@/server/services/revisions'
import { parsePageDraftMetadata } from '@/shared/revision-metadata'
import { logActivity } from '@/server/services/activity-logs'
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

  // 创建空草稿（首次自动保存时调用）
  if (body.createEmpty) {
    const page = await createEmptyPage()
    return NextResponse.json({ success: true, data: page })
  }

  if (!body.title || !body.path) {
    return NextResponse.json(
      { success: false, code: 'VALIDATION_ERROR', message: '标题和路径不能为空' },
      { status: 400 },
    )
  }

  // 定时发布必须提供发布时间
  if (body.status === 'scheduled' && !body.publishedAt) {
    return NextResponse.json(
      { success: false, code: 'VALIDATION_ERROR', message: '定时发布必须指定发布时间' },
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
      body.contentText = htmlToText(body.contentHtml)
    } else {
      body.contentHtml = body.contentHtml || body.contentRaw
      body.contentText = body.contentText || htmlToText(body.contentHtml)
    }
  }

  try {
    const page = await createPage(body)

    // 首次发布时冻结一份历史版本，与 PUT 链路对齐
    if (body.status === 'published' || body.status === 'scheduled') {
      await db.transaction(async (tx) => {
        await saveDraft(
          'page',
          page.id,
          {
            title: body.title || '',
            excerpt: '',
            contentType: body.contentType,
            contentRaw: body.contentRaw || '',
            contentHtml: body.contentHtml || '',
            contentText: body.contentText || '',
            metadata: parsePageDraftMetadata({
              path: body.path,
              template: body.template,
              seoTitle: body.seoTitle,
              seoDescription: body.seoDescription,
              publishedAt: page.publishedAt,
            }),
          },
          user.id,
          tx,
        )
        await publishDraft('page', page.id, user.id, tx)
      })
    }

    await logActivity(request, user.id, 'create_page')

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
