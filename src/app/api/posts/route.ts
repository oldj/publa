import { getCurrentUser } from '@/server/auth'
import { db } from '@/server/db'
import { htmlToText, renderMarkdown } from '@/server/lib/markdown'
import { isUniqueConstraintError, parseIntParam, safeParseJson } from '@/server/lib/request'
import {
  createEmptyPost,
  createPost,
  isSlugAvailable,
  listPostsAdmin,
} from '@/server/services/posts'
import { publishDraft, saveDraft } from '@/server/services/revisions'
import { parsePostDraftMetadata } from '@/shared/revision-metadata'
import { NextRequest, NextResponse } from 'next/server'

export async function GET(request: NextRequest) {
  const user = await getCurrentUser()
  if (!user) {
    return NextResponse.json(
      { success: false, code: 'UNAUTHORIZED', message: 'Unauthorized' },
      { status: 401 },
    )
  }

  const { searchParams } = new URL(request.url)
  const page = parseIntParam(searchParams.get('page'), 1, 1)
  const pageSize = parseIntParam(searchParams.get('pageSize'), 20, 1, 100)
  const status = searchParams.get('status') || undefined
  const categoryId = searchParams.get('categoryId')
    ? parseIntParam(searchParams.get('categoryId'), 0, 1)
    : undefined
  const search = searchParams.get('search') || undefined

  const result = await listPostsAdmin({ page, pageSize, status, categoryId, search })
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
    const post = await createEmptyPost(user.id)
    return NextResponse.json({ success: true, data: post })
  }

  if (!body.title || !body.slug) {
    return NextResponse.json(
      { success: false, code: 'VALIDATION_ERROR', message: '标题和 slug 不能为空' },
      { status: 400 },
    )
  }

  const slugOk = await isSlugAvailable(body.slug)
  if (!slugOk) {
    return NextResponse.json(
      { success: false, code: 'DUPLICATE_SLUG', message: 'slug 已存在' },
      { status: 400 },
    )
  }

  // 推导并持久化 contentType
  const ct = body.contentType || (body.isMarkdown ? 'markdown' : 'richtext')
  body.contentType = ct

  // 根据内容类型处理
  if (ct === 'markdown' && body.contentRaw) {
    body.contentHtml = await renderMarkdown(body.contentRaw)
    body.contentText = htmlToText(body.contentHtml)
  } else if (body.contentRaw) {
    // richtext 和 html: contentRaw 已经是 HTML
    body.contentHtml = body.contentHtml || body.contentRaw
    body.contentText = body.contentText || htmlToText(body.contentHtml)
  }

  try {
    const post = await createPost({ ...body, authorId: user.id })

    // 首次发布时冻结一份历史版本，与 PUT 链路对齐
    if (body.status === 'published') {
      await db.transaction(async (tx) => {
        await saveDraft(
          'post',
          post.id,
          {
            title: body.title || '',
            excerpt: body.excerpt || '',
            contentType: body.contentType,
            contentRaw: body.contentRaw || '',
            contentHtml: body.contentHtml || '',
            contentText: body.contentText || '',
            metadata: parsePostDraftMetadata({
              slug: body.slug,
              categoryId: body.categoryId,
              tagNames: body.tagNames,
              seoTitle: body.seoTitle,
              seoDescription: body.seoDescription,
              publishedAt: post.publishedAt,
            }),
          },
          user.id,
          tx,
        )
        await publishDraft('post', post.id, user.id, tx)
      })
    }

    return NextResponse.json({ success: true, data: post })
  } catch (err) {
    if (isUniqueConstraintError(err)) {
      return NextResponse.json(
        { success: false, code: 'DUPLICATE_SLUG', message: 'slug 已存在' },
        { status: 400 },
      )
    }
    throw err
  }
}
