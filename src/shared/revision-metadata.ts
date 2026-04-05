export type DraftContentType = 'richtext' | 'markdown' | 'html'

export interface PostDraftMetadata {
  slug: string
  categoryId: number | null
  tagNames: string[]
  seoTitle: string
  seoDescription: string
  publishedAt: string | null
}

export interface PageDraftMetadata {
  path: string
  template: string
  seoTitle: string
  seoDescription: string
}

export interface RevisionDraftPayload<TMetadata extends object> {
  title: string
  excerpt: string
  contentType: DraftContentType
  contentRaw: string
  contentHtml: string
  contentText: string
  metadata: TMetadata
}

function asRecord(input: unknown): Record<string, unknown> {
  if (!input || typeof input !== 'object' || Array.isArray(input)) {
    return {}
  }

  return input as Record<string, unknown>
}

function readString(value: unknown, fallback = '') {
  return typeof value === 'string' ? value : fallback
}

function readNullableString(value: unknown) {
  return typeof value === 'string' ? value : null
}

function readNullableNumber(value: unknown) {
  return typeof value === 'number' && Number.isFinite(value) ? value : null
}

function readStringArray(value: unknown) {
  if (!Array.isArray(value)) return []
  return value.filter((item): item is string => typeof item === 'string')
}

export function parsePostDraftMetadata(input: unknown): PostDraftMetadata {
  const data = asRecord(input)

  return {
    slug: readString(data.slug),
    categoryId: readNullableNumber(data.categoryId),
    tagNames: readStringArray(data.tagNames),
    seoTitle: readString(data.seoTitle),
    seoDescription: readString(data.seoDescription),
    publishedAt: readNullableString(data.publishedAt),
  }
}

export function parsePageDraftMetadata(input: unknown): PageDraftMetadata {
  const data = asRecord(input)

  return {
    path: readString(data.path),
    template: readString(data.template, 'default'),
    seoTitle: readString(data.seoTitle),
    seoDescription: readString(data.seoDescription),
  }
}
