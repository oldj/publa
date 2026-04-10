/**
 * 前端兼容层：将 Drizzle 查询结果转换为前端 IPost 等接口格式
 */
import { db } from '@/server/db'
import { maybeFirst } from '@/server/db/query'
import { categories, comments, contents, contentTags, tags } from '@/server/db/schema'
import { normalizeExternalUrl, renderUserTextToHtml } from '@/server/lib/user-content'
import { publishScheduledPosts } from '@/server/services/posts'
import { getSetting, toBool } from '@/server/services/settings'
import { and, asc, count, desc, eq, exists, inArray, isNull, lte, ne, sql } from 'drizzle-orm'
import type { ICategory, IComment, IItemPage, IPost, ITag } from 'typings'

interface FrontendPostViewer {
  id: number
}

interface BuildFrontendPostOptions {
  includeComments?: boolean
  preview?: boolean
}

interface FrontendPostBySlugOptions {
  preview?: boolean
  viewer?: FrontendPostViewer | null
}

/** 获取前台分类列表（兼容 ICategory） */
export async function getFrontendCategories(): Promise<ICategory[]> {
  const rows = await db
    .select({
      id: categories.id,
      name: categories.name,
      count: count(contents.id),
    })
    .from(categories)
    .leftJoin(
      contents,
      and(
        eq(contents.categoryId, categories.id),
        eq(contents.type, 'post'),
        eq(contents.status, 'published'),
        isNull(contents.deletedAt),
      ),
    )
    .groupBy(categories.id)
    .orderBy(asc(categories.sortOrder), asc(categories.id))

  return rows
}

/** 获取前台标签列表（兼容 ITag） */
export async function getFrontendTags(): Promise<ITag[]> {
  const rows = await db
    .select({
      id: tags.id,
      name: tags.name,
      count: count(contents.id),
    })
    .from(tags)
    .leftJoin(contentTags, eq(contentTags.tagId, tags.id))
    .leftJoin(
      contents,
      and(
        eq(contents.id, contentTags.contentId),
        eq(contents.type, 'post'),
        eq(contents.status, 'published'),
        isNull(contents.deletedAt),
      ),
    )
    .groupBy(tags.id)
    .orderBy(asc(tags.id))

  return rows
}

/** 构建 IPost 对象 */
async function buildFrontendPost(
  post: any,
  options: BuildFrontendPostOptions = {},
): Promise<IPost> {
  const { includeComments = false, preview = false } = options
  // 评论开关逻辑（PRD 4.6）
  const enableComment = toBool(await getSetting('enableComment'))
  const showCommentsGlobally = toBool(await getSetting('showCommentsGlobally'))
  // showCommentsGlobally 是最高优先级开关，关闭时一切评论相关均不显示
  const canComment = showCommentsGlobally && enableComment && post.allowComment
  const canShowComments = canComment || (showCommentsGlobally && post.showComments)
  // 获取分类
  const category = post.categoryId
    ? await maybeFirst(
        db.select().from(categories).where(eq(categories.id, post.categoryId)).limit(1),
      )
    : null

  // 获取标签
  const postTagRows = await db
    .select({ id: tags.id, name: tags.name })
    .from(contentTags)
    .innerJoin(tags, eq(contentTags.tagId, tags.id))
    .where(eq(contentTags.contentId, post.id))

  // 获取评论
  let commentList: IComment[] = []
  if (includeComments && canShowComments) {
    const commentRows = await db
      .select()
      .from(comments)
      .where(
        and(
          eq(comments.contentId, post.id),
          eq(comments.status, 'approved'),
          isNull(comments.deletedAt),
        ),
      )
      .orderBy(asc(comments.createdAt))

    // 构建评论树
    const topLevel = commentRows.filter((c) => !c.parentId)
    const childMap = new Map<number, typeof commentRows>()
    for (const c of commentRows) {
      if (c.parentId) {
        if (!childMap.has(c.parentId)) childMap.set(c.parentId, [])
        childMap.get(c.parentId)!.push(c)
      }
    }

    commentList = topLevel.map((c) => ({
      id: c.id,
      username: c.authorName,
      url: normalizeExternalUrl(c.authorWebsite) || '',
      addTime: c.createdAt,
      html: renderUserTextToHtml(c.content),
      contentId: c.contentId,
      parentId: 0,
      children: (childMap.get(c.id) || []).map((child) => ({
        id: child.id,
        username: child.authorName,
        url: normalizeExternalUrl(child.authorWebsite) || '',
        addTime: child.createdAt,
        html: renderUserTextToHtml(child.content),
        contentId: child.contentId,
        parentId: c.id,
        children: [],
      })),
    }))
  }

  // 列表场景（不含评论）：优先使用手动摘要
  const displayHtml = !includeComments && post.excerpt ? post.excerpt : post.contentHtml

  return {
    id: post.id,
    title: post.title,
    html: displayHtml,
    url: `/posts/${post.slug}`,
    slug: post.slug,
    pubTime: post.publishedAt || post.createdAt,
    category: category ? { id: category.id, name: category.name, count: 0 } : null,
    coverImage: post.coverImage || undefined,
    tags: postTagRows.map((t) => ({ id: t.id, name: t.name, count: 0 })),
    previous: { title: '', url: '' },
    next: { title: '', url: '' },
    comments: commentList,
    canComment: preview ? false : canComment,
    canShowComments: preview ? false : canShowComments,
    seoTitle: post.seoTitle || undefined,
    seoDescription: post.seoDescription || undefined,
    related: [],
  }
}

/** 获取前台文章列表（分页，兼容 IItemPage<IPost>） */
export async function getFrontendPosts(options: {
  page?: number
  pageSize?: number
  category?: string
  tag?: string
  categoryId?: number
  tagId?: number
}): Promise<IItemPage<IPost>> {
  await publishScheduledPosts()
  const { page = 1, pageSize = 10, category, tag, categoryId, tagId } = options
  const now = new Date().toISOString()

  let baseConditions = and(
    eq(contents.type, 'post'),
    eq(contents.status, 'published'),
    lte(contents.publishedAt, now),
    isNull(contents.deletedAt),
  )

  if (categoryId) {
    baseConditions = and(baseConditions, eq(contents.categoryId, categoryId))
  } else if (category) {
    // 兼容旧调用方传分类名的方式
    const cat = await maybeFirst(
      db.select().from(categories).where(eq(categories.name, category)).limit(1),
    )
    if (!cat) {
      return { items: [], page, pageCount: 0, pageSize, itemCount: 0 }
    }
    baseConditions = and(baseConditions, eq(contents.categoryId, cat.id))
  }

  if (tagId) {
    baseConditions = and(
      baseConditions,
      exists(
        db
          .select({ value: sql`1` })
          .from(contentTags)
          .where(and(eq(contentTags.contentId, contents.id), eq(contentTags.tagId, tagId))),
      ),
    )
  } else if (tag) {
    // 兼容旧调用方传标签名的方式
    const matchedTag = await maybeFirst(db.select().from(tags).where(eq(tags.name, tag)).limit(1))
    if (!matchedTag) {
      return { items: [], page, pageCount: 0, pageSize, itemCount: 0 }
    }
    baseConditions = and(
      baseConditions,
      exists(
        db
          .select({ value: sql`1` })
          .from(contentTags)
          .where(and(eq(contentTags.contentId, contents.id), eq(contentTags.tagId, matchedTag.id))),
      ),
    )
  }

  const [{ total }] = await db.select({ total: count() }).from(contents).where(baseConditions)

  const rows = await db
    .select()
    .from(contents)
    .where(baseConditions)
    .orderBy(desc(contents.pinned), desc(contents.publishedAt))
    .limit(pageSize)
    .offset((page - 1) * pageSize)

  const items = await Promise.all(rows.map((r) => buildFrontendPost(r)))

  return {
    items,
    page,
    pageCount: Math.ceil(total / pageSize),
    pageSize,
    itemCount: total,
  }
}

/** 获取前台文章详情（兼容 IPost，含前后篇和评论） */
export async function getFrontendPostBySlug(
  slug: string,
  options: FrontendPostBySlugOptions = {},
): Promise<IPost | null> {
  await publishScheduledPosts()
  const { preview = false, viewer = null } = options
  const now = new Date().toISOString()

  if (preview && !viewer) return null

  const conditions = preview
    ? and(eq(contents.type, 'post'), eq(contents.slug, slug), isNull(contents.deletedAt))
    : and(
        eq(contents.type, 'post'),
        eq(contents.slug, slug),
        eq(contents.status, 'published'),
        lte(contents.publishedAt, now),
        isNull(contents.deletedAt),
      )

  const row = await maybeFirst(db.select().from(contents).where(conditions).limit(1))

  if (!row) return null

  const post = await buildFrontendPost(row, { includeComments: true, preview })

  // 获取前后篇
  if (row.publishedAt) {
    const prev = await db
      .select({ title: contents.title, slug: contents.slug })
      .from(contents)
      .where(
        and(
          eq(contents.type, 'post'),
          eq(contents.status, 'published'),
          lte(contents.publishedAt, now),
          isNull(contents.deletedAt),
          sql`${contents.publishedAt} < ${row.publishedAt}`,
        ),
      )
      .orderBy(desc(contents.publishedAt))
      .limit(1)

    const next = await db
      .select({ title: contents.title, slug: contents.slug })
      .from(contents)
      .where(
        and(
          eq(contents.type, 'post'),
          eq(contents.status, 'published'),
          lte(contents.publishedAt, now),
          isNull(contents.deletedAt),
          sql`${contents.publishedAt} > ${row.publishedAt}`,
        ),
      )
      .orderBy(asc(contents.publishedAt))
      .limit(1)

    if (prev[0]) {
      post.previous = { title: prev[0].title, url: `/posts/${prev[0].slug}` }
    }
    if (next[0]) {
      post.next = { title: next[0].title, url: `/posts/${next[0].slug}` }
    }
  }

  // 获取相关文章
  if (row.categoryId) {
    const tagIds = post.tags.map((t) => t.id)

    const baseConditions = and(
      eq(contents.type, 'post'),
      eq(contents.status, 'published'),
      lte(contents.publishedAt, now),
      isNull(contents.deletedAt),
      eq(contents.categoryId, row.categoryId),
      ne(contents.id, row.id),
    )

    let relatedRows: { title: string; slug: string | null }[]

    if (tagIds.length > 0) {
      // 有标签：按共同标签数排序
      relatedRows = await db
        .select({ title: contents.title, slug: contents.slug })
        .from(contents)
        .leftJoin(
          contentTags,
          and(eq(contentTags.contentId, contents.id), inArray(contentTags.tagId, tagIds)),
        )
        .where(baseConditions)
        .groupBy(contents.id, contents.title, contents.slug, contents.publishedAt)
        .orderBy(desc(count(contentTags.tagId)), desc(contents.publishedAt))
        .limit(100)
    } else {
      // 无标签：按发布时间排序
      relatedRows = await db
        .select({ title: contents.title, slug: contents.slug })
        .from(contents)
        .where(baseConditions)
        .orderBy(desc(contents.publishedAt))
        .limit(100)
    }

    // 取前 3 条最相关的，再从剩余中随机取 2 条
    const filtered = relatedRows.filter((r) => r.slug)
    const top = filtered.slice(0, 3)
    const rest = filtered.slice(3)
    for (let i = rest.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1))
      ;[rest[i], rest[j]] = [rest[j], rest[i]]
    }
    const picked = [...top, ...rest.slice(0, 2)]

    post.related = picked.map((r) => ({
      title: r.title,
      url: `/posts/${r.slug}`,
    }))
  }

  return post
}

/** 获取前台归档列表 */
export async function getFrontendArchive() {
  const now = new Date().toISOString()

  const rows = await db
    .select({
      title: contents.title,
      slug: contents.slug,
      publishedAt: contents.publishedAt,
    })
    .from(contents)
    .where(
      and(
        eq(contents.type, 'post'),
        eq(contents.status, 'published'),
        lte(contents.publishedAt, now),
        isNull(contents.deletedAt),
      ),
    )
    .orderBy(desc(contents.publishedAt))

  const archive: Record<number, { title: string; url: string; pubTime: string }[]> = {}
  for (const row of rows) {
    const year = row.publishedAt ? parseInt(row.publishedAt.substring(0, 4)) : 0
    if (!archive[year]) archive[year] = []
    archive[year].push({
      title: row.title,
      url: `/posts/${row.slug}`,
      pubTime: row.publishedAt || '',
    })
  }

  return Object.entries(archive)
    .sort(([a], [b]) => Number(b) - Number(a))
    .map(([year, list]) => ({ year: Number(year), list }))
}

/** 获取文章评论（兼容 IComment[]） */
export async function getFrontendComments(postSlug: string): Promise<IComment[]> {
  const post = await maybeFirst(
    db
      .select({ id: contents.id })
      .from(contents)
      .where(and(eq(contents.slug, postSlug), eq(contents.type, 'post')))
      .limit(1),
  )
  if (!post) return []

  const rows = await db
    .select()
    .from(comments)
    .where(
      and(
        eq(comments.contentId, post.id),
        eq(comments.status, 'approved'),
        isNull(comments.deletedAt),
      ),
    )
    .orderBy(asc(comments.createdAt))

  const topLevel = rows.filter((c) => !c.parentId)
  const childMap = new Map<number, typeof rows>()
  for (const c of rows) {
    if (c.parentId) {
      if (!childMap.has(c.parentId)) childMap.set(c.parentId, [])
      childMap.get(c.parentId)!.push(c)
    }
  }

  return topLevel.map((c) => ({
    id: c.id,
    username: c.authorName,
    url: normalizeExternalUrl(c.authorWebsite) || '',
    addTime: c.createdAt,
    html: renderUserTextToHtml(c.content),
    contentId: c.contentId,
    parentId: 0,
    children: (childMap.get(c.id) || []).map((child) => ({
      id: child.id,
      username: child.authorName,
      url: normalizeExternalUrl(child.authorWebsite) || '',
      addTime: child.createdAt,
      html: renderUserTextToHtml(child.content),
      contentId: child.contentId,
      parentId: c.id,
      children: [],
    })),
  }))
}
