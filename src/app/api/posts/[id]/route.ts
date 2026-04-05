import { getCurrentUser } from '@/server/auth'
import { htmlToText, renderMarkdown } from '@/server/lib/markdown'
import { isUniqueConstraintError, parseIdParam, safeParseJson } from '@/server/lib/request'
import { deletePost, getPostById, isSlugAvailable, updatePost } from '@/server/services/posts'
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
  const { id: postId, error: idError } = parseIdParam(idStr)
  if (idError) return idError
  const post = await getPostById(postId)
  if (!post) {
    return NextResponse.json(
      { success: false, code: 'NOT_FOUND', message: '文章不存在' },
      { status: 404 },
    )
  }

  // 附带草稿内容（如果有）
  const draft = await getDraft('post', post.id)
  return NextResponse.json({
    success: true,
    data: {
      ...post,
      draftContent: draft
        ? {
            title: draft.title,
            excerpt: draft.excerpt,
            contentType: draft.contentType,
            contentRaw: draft.contentRaw,
            contentHtml: draft.contentHtml,
            contentText: draft.contentText,
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
  const { id: postId, error: idError } = parseIdParam(idStr)
  if (idError) return idError
  const { data: body, error } = await safeParseJson(request)
  if (error) return error

  if (body.slug) {
    const slugOk = await isSlugAvailable(body.slug, postId)
    if (!slugOk) {
      return NextResponse.json(
        { success: false, code: 'DUPLICATE_SLUG', message: 'slug 已存在' },
        { status: 400 },
      )
    }
  }

  // 推导并持久化 contentType
  const ct = body.contentType || (body.isMarkdown ? 'markdown' : 'richtext')
  body.contentType = ct

  // 根据内容类型处理
  if (ct === 'markdown' && body.contentRaw) {
    body.contentHtml = await renderMarkdown(body.contentRaw)
    body.contentText = htmlToText(body.contentHtml)
  } else if (body.contentRaw) {
    body.contentHtml = body.contentHtml || body.contentRaw
    body.contentText = body.contentText || htmlToText(body.contentHtml)
  }

  try {
    const post = await updatePost(postId, body)
    if (!post) {
      return NextResponse.json(
        { success: false, code: 'NOT_FOUND', message: '文章不存在' },
        { status: 404 },
      )
    }

    // 发布时将草稿冻结为历史版本
    if (body.status === 'published') {
      await publishDraft('post', postId)
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
  const { id: postId, error: idError } = parseIdParam(idStr)
  if (idError) return idError
  await deletePost(postId)
  return NextResponse.json({ success: true })
}
