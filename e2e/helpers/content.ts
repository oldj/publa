import type { APIRequestContext, APIResponse } from '@playwright/test'

export interface CreatedPost {
  id: number
  title: string
  slug: string
}

export interface CreatedPage {
  id: number
  title: string
  path: string
}

async function expectSuccess<T>(response: APIResponse, action: string): Promise<T> {
  const json = (await response.json()) as {
    success: boolean
    data?: T
    message?: string
  }

  if (!response.ok() || !json.success || !json.data) {
    throw new Error(json.message || `${action}失败`)
  }

  return json.data
}

export async function createPostRecord(
  api: APIRequestContext,
  input: { title: string; slug: string; bodyText: string },
): Promise<CreatedPost> {
  const html = `<p>${input.bodyText}</p>`
  const response = await api.post('/api/posts', {
    data: {
      title: input.title,
      slug: input.slug,
      contentType: 'richtext',
      contentRaw: html,
      contentHtml: html,
      contentText: input.bodyText,
      excerpt: '',
      status: 'draft',
      categoryId: null,
      tagIds: [],
      tagNames: [],
      allowComment: true,
      showComments: true,
      pinned: false,
      coverImage: null,
      seoTitle: '',
      seoDescription: '',
    },
    failOnStatusCode: false,
  })

  const data = await expectSuccess<{ id: number; title: string; slug: string }>(
    response,
    '创建文章',
  )
  return {
    id: data.id,
    title: data.title,
    slug: data.slug,
  }
}

export async function createPageRecord(
  api: APIRequestContext,
  input: { title: string; path: string; bodyText: string },
): Promise<CreatedPage> {
  const html = `<p>${input.bodyText}</p>`
  const response = await api.post('/api/pages', {
    data: {
      title: input.title,
      path: input.path,
      template: 'default',
      mimeType: '',
      contentType: 'richtext',
      contentRaw: html,
      contentHtml: html,
      contentText: input.bodyText,
      status: 'draft',
      seoTitle: '',
      seoDescription: '',
    },
    failOnStatusCode: false,
  })

  const data = await expectSuccess<{ id: number; title: string; path: string }>(
    response,
    '创建页面',
  )
  return {
    id: data.id,
    title: data.title,
    path: data.path,
  }
}
