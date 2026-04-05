import path from 'path'
import { beforeAll, beforeEach, afterAll, describe, expect, it, vi } from 'vitest'
import { drizzle } from 'drizzle-orm/node-postgres'
import { migrate } from 'drizzle-orm/node-postgres/migrator'
import { Pool } from 'pg'
// 运行时 postgresSchema 包含 PG 表对象，但统一 schema 后静态类型为 SQLite，
// 此处 cast 为 any 以兼容 drizzle PG 驱动的类型要求
import { postgresSchema as _postgresSchema } from '@/server/db/schema/postgres'
const postgresSchema = _postgresSchema as any // eslint-disable-line @typescript-eslint/no-explicit-any

const pgTestDatabaseUrl = process.env.PG_TEST_DATABASE_URL
const describePostgres = pgTestDatabaseUrl ? describe : describe.skip

/** 注意：该测试会清空 PG_TEST_DATABASE_URL 指向的测试库。 */
describePostgres('postgres contract', () => {
  const originalDatabaseFamily = process.env.DATABASE_FAMILY
  const truncateTables = [
    'content_revisions',
    'content_tags',
    'slug_histories',
    'comments',
    'guestbook_messages',
    'contents',
    'categories',
    'tags',
    'menus',
    'redirect_rules',
    'settings',
    'attachments',
    'captchas',
    'rate_events',
    'users',
  ]
    .map((tableName) => `"${tableName}"`)
    .join(', ')

  let pool: Pool
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let db: ReturnType<typeof drizzle<any>>
  let usersService: Awaited<typeof import('./users')>
  let pagesService: Awaited<typeof import('./pages')>
  let postsService: Awaited<typeof import('./posts')>
  let commentsService: Awaited<typeof import('./comments')>
  let categoriesService: Awaited<typeof import('./categories')>
  let tagsService: Awaited<typeof import('./tags')>
  let guestbookService: Awaited<typeof import('./guestbook')>
  let revisionsService: Awaited<typeof import('./revisions')>
  let importExportService: Awaited<typeof import('./import-export')>
  let ownerId = 0
  let editorId = 0

  beforeAll(async () => {
    process.env.DATABASE_FAMILY = 'postgres'

    pool = new Pool({ connectionString: pgTestDatabaseUrl })
    // 清除 drizzle 迁移记录和所有业务表，确保迁移在干净状态下执行
    await pool.query('DROP SCHEMA IF EXISTS drizzle CASCADE')
    await pool.query(`
      DO $$ DECLARE r RECORD;
      BEGIN
        FOR r IN (SELECT tablename FROM pg_tables WHERE schemaname = 'public') LOOP
          EXECUTE 'DROP TABLE IF EXISTS public.' || quote_ident(r.tablename) || ' CASCADE';
        END LOOP;
      END $$;
    `)
    db = drizzle(pool, { schema: postgresSchema })

    await migrate(db, {
      migrationsFolder: path.join(process.cwd(), 'drizzle', 'postgres'),
    })

    vi.resetModules()
    vi.doMock('@/server/db', () => ({
      db,
      dbFamily: 'postgres',
      dbReady: Promise.resolve(),
    }))

    usersService = await import('./users')
    pagesService = await import('./pages')
    postsService = await import('./posts')
    commentsService = await import('./comments')
    categoriesService = await import('./categories')
    tagsService = await import('./tags')
    guestbookService = await import('./guestbook')
    revisionsService = await import('./revisions')
    importExportService = await import('./import-export')
  })

  beforeEach(async () => {
    await pool.query(`TRUNCATE TABLE ${truncateTables} RESTART IDENTITY CASCADE`)
    const insertedUsers = await db
      .insert(postgresSchema.users)
      .values([
        { username: 'admin', passwordHash: 'hash', role: 'owner' },
        { username: 'editor', passwordHash: 'hash', role: 'editor' },
      ])
      .returning({
        id: postgresSchema.users.id,
        username: postgresSchema.users.username,
      })

    ownerId = insertedUsers.find((user) => user.username === 'admin')!.id
    editorId = insertedUsers.find((user) => user.username === 'editor')!.id
  })

  afterAll(async () => {
    vi.doUnmock('@/server/db')
    if (pool) await pool.end()

    if (originalDatabaseFamily) process.env.DATABASE_FAMILY = originalDatabaseFamily
    else delete process.env.DATABASE_FAMILY
  })

  it('用户服务在 PostgreSQL 上可读写', async () => {
    const created = await usersService.createUser({
      username: 'pg-user',
      password: 'secret123',
      role: 'editor',
      email: 'pg@example.com',
    })

    expect(created.id).toBeGreaterThan(0)
    expect(created.passwordHash).not.toBe('secret123')

    const fetched = await usersService.getUserById(created.id)
    expect(fetched?.username).toBe('pg-user')
    expect(fetched?.email).toBe('pg@example.com')
  })

  it('页面服务在 PostgreSQL 上可读写', async () => {
    const created = await pagesService.createPage({
      title: '关于',
      path: 'about',
      contentRaw: '关于页',
      contentHtml: '<p>关于页</p>',
      status: 'published',
      publishedAt: new Date().toISOString(),
    })

    const fetched = await pagesService.getPublishedPageByPath('about')
    expect(created.id).toBeGreaterThan(0)
    expect(fetched?.title).toBe('关于')
  })

  it('文章和评论服务在 PostgreSQL 上行为一致', async () => {
    const post = await postsService.createPost({
      title: 'Postgres 文章',
      slug: 'postgres-post',
      authorId: ownerId,
      contentRaw: '# Hello',
      contentHtml: '<h1>Hello</h1>',
      contentText: 'Hello',
      status: 'published',
      allowComment: true,
      showComments: true,
      publishedAt: new Date().toISOString(),
    })

    const commentResult = await commentsService.createComment({
      contentId: post.id,
      authorName: '访客',
      content: '测试评论',
    })

    expect(commentResult.success).toBe(true)

    const fetched = await postsService.getPostById(post.id)
    expect(fetched?.title).toBe('Postgres 文章')
    expect(fetched?.tagIds).toEqual([])
  })

  it('文章布尔字段在 PostgreSQL 上保持 true/false 语义', async () => {
    const post = await postsService.createPost({
      title: '布尔字段文章',
      slug: 'postgres-boolean-post',
      authorId: ownerId,
      contentRaw: '# Bool',
      contentHtml: '<h1>Bool</h1>',
      contentText: 'Bool',
      status: 'published',
      allowComment: false,
      showComments: false,
      pinned: true,
      publishedAt: new Date().toISOString(),
    })

    const fetched = await postsService.getPostById(post.id)
    expect(fetched?.allowComment).toBe(false)
    expect(fetched?.showComments).toBe(false)
    expect(fetched?.pinned).toBe(true)

    const blockedComment = await commentsService.createComment({
      contentId: post.id,
      authorName: '访客',
      content: '不应被允许',
    })
    expect(blockedComment.success).toBe(false)

    await postsService.updatePost(post.id, {
      allowComment: true,
      showComments: true,
      pinned: false,
    })

    const updated = await postsService.getPostById(post.id)
    expect(updated?.allowComment).toBe(true)
    expect(updated?.showComments).toBe(true)
    expect(updated?.pinned).toBe(false)
  })

  it('分类和标签聚合在 PostgreSQL 上返回稳定计数', async () => {
    const earlierCategory = await categoriesService.createCategory({
      name: '更早分类',
      slug: 'earlier-category',
      sortOrder: 5,
    })
    const laterCategory = await categoriesService.createCategory({
      name: '更晚分类',
      slug: 'later-category',
      sortOrder: 20,
    })
    const tagA = await tagsService.createTag({ name: '标签 A', slug: 'tag-a' })
    const tagB = await tagsService.createTag({ name: '标签 B', slug: 'tag-b' })

    await postsService.createPost({
      title: '已发布文章',
      slug: 'published-with-tag-a',
      authorId: ownerId,
      contentRaw: '# Published',
      contentHtml: '<h1>Published</h1>',
      contentText: 'Published',
      status: 'published',
      categoryId: laterCategory.id,
      tagIds: [tagA.id],
      publishedAt: new Date().toISOString(),
    })

    await postsService.createPost({
      title: '草稿文章',
      slug: 'draft-with-tags',
      authorId: ownerId,
      contentRaw: '# Draft',
      contentHtml: '<h1>Draft</h1>',
      contentText: 'Draft',
      status: 'draft',
      categoryId: laterCategory.id,
      tagIds: [tagA.id, tagB.id],
    })

    const deletedPost = await postsService.createPost({
      title: '已删除文章',
      slug: 'deleted-post',
      authorId: ownerId,
      contentRaw: '# Deleted',
      contentHtml: '<h1>Deleted</h1>',
      contentText: 'Deleted',
      status: 'published',
      categoryId: earlierCategory.id,
      publishedAt: new Date().toISOString(),
    })
    await postsService.deletePost(deletedPost.id)

    const categoryRows = await categoriesService.listCategories()
    expect(
      categoryRows.map((row) => ({
        slug: row.slug,
        sortOrder: row.sortOrder,
        postCount: row.postCount,
      })),
    ).toEqual([
      { slug: 'earlier-category', sortOrder: 5, postCount: 0 },
      { slug: 'later-category', sortOrder: 20, postCount: 1 },
    ])
    expect(typeof categoryRows[0].postCount).toBe('number')

    const tagRows = await tagsService.listTags()
    expect(
      tagRows.map((row) => ({
        slug: row.slug,
        postCount: row.postCount,
      })),
    ).toEqual([
      { slug: 'tag-a', postCount: 1 },
      { slug: 'tag-b', postCount: 0 },
    ])
    expect(typeof tagRows[0].postCount).toBe('number')
  })

  it('导入导出服务在 PostgreSQL 上可执行事务写入', async () => {
    await importExportService.importContentData(
      {
        categories: [{ id: 10, name: '技术', slug: 'tech' }],
        tags: [{ id: 20, name: 'PostgreSQL', slug: 'postgresql' }],
        posts: [
          {
            id: 100,
            title: '导入文章',
            slug: 'imported-post',
            authorId: ownerId,
            contentRaw: '# Imported',
            contentHtml: '<h1>Imported</h1>',
            contentText: 'Imported',
            status: 'published',
            categoryId: 10,
          },
        ],
        contentTags: [{ contentId: 100, tagId: 20 }],
        comments: [],
        guestbookMessages: [],
        attachments: [],
      },
      1,
    )

    const exported = await importExportService.exportContentData()
    expect(exported.categories).toHaveLength(1)
    expect(exported.posts).toHaveLength(1)
    expect(exported.contentTags).toHaveLength(1)
    expect(exported.posts[0].authorId).toBe(ownerId)
  })

  it('导入显式主键后默认自增写入不会复用旧序列', async () => {
    await importExportService.importContentData(
      {
        categories: [{ id: 10, name: '技术', slug: 'tech' }],
        tags: [],
        posts: [
          {
            id: 100,
            title: '已有文章',
            slug: 'seeded-post',
            authorId: ownerId,
            contentRaw: '# Seeded',
            contentHtml: '<h1>Seeded</h1>',
            contentText: 'Seeded',
            status: 'published',
            categoryId: 10,
          },
        ],
        contentTags: [],
        comments: [],
        guestbookMessages: [],
        attachments: [],
      },
      ownerId,
    )

    const createdPost = await postsService.createPost({
      title: '新文章',
      slug: 'next-post',
      authorId: editorId,
      contentRaw: '# Next',
      contentHtml: '<h1>Next</h1>',
      contentText: 'Next',
      status: 'published',
      publishedAt: new Date().toISOString(),
    })

    await importExportService.importSettingsData(
      {
        settings: [],
        pages: [
          {
            id: 50,
            title: '导入页面',
            path: 'imported-page',
            contentType: 'markdown',
            contentRaw: 'imported',
            contentHtml: '<p>imported</p>',
            template: 'default',
            status: 'published',
            publishedAt: new Date().toISOString(),
          },
        ],
        menus: [],
        users: [],
      },
      ownerId,
    )

    const createdPage = await pagesService.createPage({
      title: '新页面',
      path: 'next-page',
      contentRaw: 'next',
      contentHtml: '<p>next</p>',
      status: 'published',
      publishedAt: new Date().toISOString(),
    })

    expect(createdPost.id).toBeGreaterThan(100)
    expect(createdPage.id).toBeGreaterThan(50)
  })

  it('留言状态和计数在 PostgreSQL 上行为一致', async () => {
    const first = await guestbookService.createGuestbookMessage({
      authorName: 'Alice',
      content: '第一条留言',
    })
    const second = await guestbookService.createGuestbookMessage({
      authorName: 'Bob',
      content: '第二条留言',
    })

    const unreadBefore = await guestbookService.countUnreadGuestbookMessages()
    expect(unreadBefore).toBe(2)
    expect(typeof unreadBefore).toBe('number')

    await guestbookService.markGuestbookMessageRead(first.data.id)
    await guestbookService.deleteGuestbookMessage(second.data.id)

    const unreadAfter = await guestbookService.countUnreadGuestbookMessages()
    expect(unreadAfter).toBe(0)

    const unreadList = await guestbookService.listGuestbookMessages({ status: 'unread' })
    expect(unreadList.itemCount).toBe(0)
    expect(typeof unreadList.itemCount).toBe('number')

    const allList = await guestbookService.listGuestbookMessages()
    expect(allList.itemCount).toBe(1)
  })

  it('修订删除和恢复在 PostgreSQL 上行为一致', async () => {
    await revisionsService.saveDraft(
      'post',
      42,
      {
        title: 'v1',
        excerpt: '',
        contentRaw: 'content-v1',
        contentHtml: '<p>content-v1</p>',
        contentText: 'content-v1',
      },
      ownerId,
    )
    await revisionsService.publishDraft('post', 42)

    await revisionsService.saveDraft(
      'post',
      42,
      {
        title: 'v2',
        excerpt: '',
        contentRaw: 'content-v2',
        contentHtml: '<p>content-v2</p>',
        contentText: 'content-v2',
      },
      ownerId,
    )
    await revisionsService.publishDraft('post', 42)

    const published = await revisionsService.listPublishedRevisions('post', 42)
    expect(published).toHaveLength(2)

    const publishedRows = await Promise.all(
      published.map((revision) => revisionsService.getRevisionById(revision.id)),
    )
    const revisionToDelete = publishedRows.find((revision) => revision?.contentRaw === 'content-v2')

    const deletedCount = await revisionsService.deleteRevisions('post', 42, [revisionToDelete!.id])
    expect(deletedCount).toBe(1)

    await revisionsService.saveDraft(
      'post',
      42,
      {
        title: 'draft',
        excerpt: '',
        contentRaw: 'draft-only',
        contentHtml: '<p>draft-only</p>',
        contentText: 'draft-only',
      },
      editorId,
    )
    const draft = await revisionsService.getDraft('post', 42)
    const deletedDraftCount = await revisionsService.deleteRevisions('post', 42, [draft!.id])
    expect(deletedDraftCount).toBe(0)
    expect((await revisionsService.getDraft('post', 42))?.contentRaw).toBe('draft-only')

    const remaining = await revisionsService.listPublishedRevisions('post', 42)
    const restored = await revisionsService.restoreRevision('post', 42, remaining[0].id, editorId)
    expect(restored?.content.contentRaw).toBe('content-v1')
    expect(await revisionsService.getDraft('post', 42)).toBeNull()
    expect(await revisionsService.listPublishedRevisions('post', 42)).toHaveLength(2)
  })
})
