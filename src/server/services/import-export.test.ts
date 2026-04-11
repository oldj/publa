import { maybeFirst } from '@/server/db/query'
import * as schema from '@/server/db/schema'
import ver from '@/version.json'
import { asc, eq } from 'drizzle-orm'
import { beforeEach, describe, expect, it } from 'vitest'
import { setupTestDb, testDb } from './__test__/setup'

const {
  exportContentData,
  exportSettingsData,
  importContentData,
  importSettingsData,
  validateImportData,
} = await import('./import-export')

const PUBLA_VERSION = ver.join('.')

beforeEach(async () => {
  await setupTestDb()
})

// 辅助：插入测试内容数据
async function seedContentData() {
  await testDb.insert(schema.categories).values([
    { id: 10, name: '技术', slug: 'tech' },
    { id: 11, name: '生活', slug: 'life' },
  ])
  await testDb.insert(schema.tags).values([{ id: 20, name: 'JavaScript', slug: 'javascript' }])
  await testDb.insert(schema.contents).values([
    {
      id: 100,
      type: 'post',
      title: '测试文章',
      slug: 'test-post',
      authorId: 1,
      contentRaw: '# Hello',
      contentHtml: '<h1>Hello</h1>',
      contentText: 'Hello',
      status: 'published',
      categoryId: 10,
    },
    {
      id: 50,
      type: 'page',
      title: '关于',
      path: '/about',
      contentRaw: '关于我',
      contentHtml: '<p>关于我</p>',
      status: 'published',
    },
  ])
  await testDb.insert(schema.contentTags).values([{ contentId: 100, tagId: 20 }])
  await testDb
    .insert(schema.comments)
    .values([{ id: 200, contentId: 100, authorName: '访客', content: '好文', status: 'approved' }])
  await testDb
    .insert(schema.guestbookMessages)
    .values([{ id: 300, authorName: '路人', content: '你好', status: 'unread' }])
  await testDb.insert(schema.contentRevisions).values([
    {
      id: 400,
      targetType: 'post',
      targetId: 100,
      title: '测试文章（旧）',
      contentType: 'richtext',
      contentRaw: '# Old',
      contentHtml: '<h1>Old</h1>',
      contentText: 'Old',
      status: 'published',
      createdBy: 1,
    },
  ])
  await testDb
    .insert(schema.slugHistories)
    .values([{ id: 500, contentId: 100, slug: 'old-test-post' }])
}

// 辅助：插入测试设置数据
async function seedSettingsData() {
  await testDb.insert(schema.settings).values([
    { key: 'siteTitle', value: '"我的博客"' },
    { key: 'siteUrl', value: '"https://example.com"' },
  ])
  await testDb.insert(schema.menus).values([{ id: 60, title: '首页', url: '/' }])
  await testDb.insert(schema.redirectRules).values([
    {
      id: 70,
      sortOrder: 1,
      pathRegex: '^/old/(\\d+)$',
      redirectTo: '/posts/$1',
      redirectType: '301',
      memo: '旧路径跳转',
    },
  ])
}

describe('validateImportData', () => {
  it('缺少 meta 信息', () => {
    expect(validateImportData({})).toEqual({ valid: false, message: '缺少 meta 信息' })
    expect(validateImportData({ meta: {} })).toEqual({ valid: false, message: '缺少 meta 信息' })
  })

  it('不支持的版本', () => {
    const result = validateImportData({ meta: { type: 'content', version: '1.0' } })
    expect(result.valid).toBe(false)
    expect(result.message).toContain('1.0')
  })

  it('未知的数据类型', () => {
    const result = validateImportData({ meta: { type: 'unknown', version: '2.0' } })
    expect(result.valid).toBe(false)
    expect(result.message).toContain('unknown')
  })

  it('内容数据缺少必要字段', () => {
    const result = validateImportData({
      meta: { type: 'content', version: '2.0' },
      categories: [],
      tags: [],
      // 缺少 contents
    })
    expect(result.valid).toBe(false)
    expect(result.message).toContain('contents')
  })

  it('内容数据校验通过', () => {
    const result = validateImportData({
      meta: { type: 'content', version: '2.0' },
      categories: [],
      tags: [],
      contents: [],
    })
    expect(result).toEqual({ valid: true, type: 'content' })
  })

  it('设置数据缺少必要字段', () => {
    const result = validateImportData({
      meta: { type: 'settings', version: '2.0' },
      // 缺少 settings
    })
    expect(result.valid).toBe(false)
    expect(result.message).toContain('settings')
  })

  it('设置数据校验通过', () => {
    const result = validateImportData({
      meta: { type: 'settings', version: '2.0' },
      settings: [],
    })
    expect(result).toEqual({ valid: true, type: 'settings' })
  })

  it('设置数据中 themes / customStyles 必须是数组', () => {
    expect(
      validateImportData({
        meta: { type: 'settings', version: '2.0' },
        settings: [],
        themes: 'not-array',
      }).valid,
    ).toBe(false)
    expect(
      validateImportData({
        meta: { type: 'settings', version: '2.0' },
        settings: [],
        customStyles: 123,
      }).valid,
    ).toBe(false)
  })

  it('设置数据中 themes / customStyles 缺失时仍可通过', () => {
    expect(
      validateImportData({
        meta: { type: 'settings', version: '2.0' },
        settings: [],
      }),
    ).toEqual({ valid: true, type: 'settings' })
  })
})

describe('exportContentData', () => {
  it('导出内容数据包含 meta 信息', async () => {
    const data = await exportContentData()
    expect(data.meta.type).toBe('content')
    expect(data.meta.version).toBe('2.0')
    expect(data.meta.publaVersion).toBe(PUBLA_VERSION)
    expect(data.meta.exportedAt).toBeDefined()
  })

  it('导出包含所有内容表', async () => {
    await seedContentData()
    const data = await exportContentData()
    expect(data.categories).toHaveLength(2)
    expect(data.tags).toHaveLength(1)
    expect(data.contents).toHaveLength(2) // 文章+页面
    expect(data.contentTags).toHaveLength(1)
    expect(data.comments).toHaveLength(1)
    expect(data.guestbookMessages).toHaveLength(1)
    expect(data.contentRevisions).toHaveLength(1)
    expect(data.slugHistories).toHaveLength(1)
  })

  it('导出包含文章和页面', async () => {
    await seedContentData()
    const data = await exportContentData()
    const types = data.contents.map((c: any) => c.type)
    expect(types).toContain('post')
    expect(types).toContain('page')
  })

  it('导出包含软删除记录及其 deletedAt 字段', async () => {
    await seedContentData()
    const deletedAt = new Date().toISOString()
    await testDb.update(schema.contents).set({ deletedAt }).where(eq(schema.contents.id, 100))

    const data = await exportContentData()
    expect(data.contents).toHaveLength(2) // 软删除的也导出
    const deleted = data.contents.find((c: any) => c.id === 100)
    expect(deleted?.deletedAt).toBe(deletedAt)
    const alive = data.contents.find((c: any) => c.id === 50)
    expect(alive?.deletedAt).toBeNull()
  })

  it('空数据库导出空数组', async () => {
    const data = await exportContentData()
    expect(data.categories).toHaveLength(0)
    expect(data.contents).toHaveLength(0)
    expect(data.contentRevisions).toHaveLength(0)
    expect(data.slugHistories).toHaveLength(0)
  })
})

describe('exportSettingsData', () => {
  it('导出设置数据包含 meta 信息', async () => {
    const data = await exportSettingsData()
    expect(data.meta.type).toBe('settings')
    expect(data.meta.version).toBe('2.0')
    expect(data.meta.publaVersion).toBe(PUBLA_VERSION)
  })

  it('导出包含所有设置表', async () => {
    await seedSettingsData()
    const data = await exportSettingsData()
    expect(data.settings).toHaveLength(2)
    expect(data.menus).toHaveLength(1)
    expect(data.redirectRules).toHaveLength(1)
    expect(data.users).toHaveLength(2) // setupTestDb 插入了 2 个用户
  })

  it('设置数据不包含 pages', async () => {
    await seedContentData()
    const data = await exportSettingsData()
    expect(data).not.toHaveProperty('pages')
  })

  it('redirectRules 使用 sortOrder 字段', async () => {
    await seedSettingsData()
    const data = await exportSettingsData()
    expect(data.redirectRules[0]).toHaveProperty('sortOrder')
    expect(data.redirectRules[0]).not.toHaveProperty('order')
  })

  it('导出设置数据不包含敏感字段', async () => {
    await testDb.insert(schema.settings).values([
      { key: 'storageProvider', value: '"s3"' },
      { key: 'storageS3Bucket', value: '"my-bucket"' },
      { key: 'storageS3AccessKey', value: '"AKID_SECRET"' },
      { key: 'storageS3SecretKey', value: '"SECRET_KEY_VALUE"' },
      { key: 'jwtSecret', value: '"jwt-secret-value"' },
    ])
    const data = await exportSettingsData()
    const keys = data.settings.map((s) => s.key)
    expect(keys).toContain('storageProvider')
    expect(keys).toContain('storageS3Bucket')
    expect(keys).not.toContain('storageS3AccessKey')
    expect(keys).not.toContain('storageS3SecretKey')
    expect(keys).not.toContain('jwtSecret')
  })

  it('导出设置数据会忽略未知或废弃设置项', async () => {
    await testDb.insert(schema.settings).values([
      { key: 'siteTitle', value: '"我的博客"' },
      { key: 'allowThemeToggle', value: 'true' },
      { key: 'legacySetting', value: '"legacy"' },
    ])

    const data = await exportSettingsData()
    const keys = data.settings.map((item) => item.key)

    expect(keys).toContain('siteTitle')
    expect(keys).not.toContain('allowThemeToggle')
    expect(keys).not.toContain('legacySetting')
  })

  it('导出设置数据会按真实类型输出 value', async () => {
    await testDb.insert(schema.settings).values([
      { key: 'siteTitle', value: '"我的博客"' },
      { key: 'enableComment', value: 'false' },
      { key: 'rssLimit', value: '20' },
      { key: 'emailNotifyNewComment', value: '{"enabled":true,"userIds":[1]}' },
    ])

    const data = await exportSettingsData()
    const map = Object.fromEntries(data.settings.map((item) => [item.key, item.value]))

    expect(map.siteTitle).toBe('我的博客')
    expect(map.enableComment).toBe(false)
    expect(map.rssLimit).toBe(20)
    expect(map.emailNotifyNewComment).toEqual({ enabled: true, userIds: [1] })
  })

  it('用户数据不包含密码', async () => {
    const data = await exportSettingsData()
    for (const u of data.users) {
      expect(u).not.toHaveProperty('passwordHash')
    }
  })

  it('导出设置数据包含 themes 与 customStyles', async () => {
    await testDb.insert(schema.themes).values([
      { id: 101, name: '浅色', css: '', sortOrder: 1, builtinKey: 'light' },
      { id: 102, name: '自定义主题', css: 'body{color:red}', sortOrder: 10, builtinKey: null },
    ])
    await testDb
      .insert(schema.customStyles)
      .values([{ id: 201, name: '片段 A', css: '.a{}', sortOrder: 1 }])

    const data = await exportSettingsData()
    expect(data.themes).toHaveLength(2)
    expect(data.themes.find((t: any) => t.id === 102)?.name).toBe('自定义主题')
    expect(data.customStyles).toHaveLength(1)
    expect(data.customStyles[0].name).toBe('片段 A')
  })
})

describe('importContentData', () => {
  it('覆盖导入清空现有数据（包括文章和页面）', async () => {
    await seedContentData()

    await importContentData(
      {
        categories: [{ id: 1, name: '新分类', slug: 'new' }],
        tags: [],
        contents: [],
        contentTags: [],
        comments: [],
        guestbookMessages: [],
      },
      1,
    )

    const cats = await testDb.select().from(schema.categories)
    expect(cats).toHaveLength(1)
    expect(cats[0].name).toBe('新分类')

    // 文章和页面都应该被清空
    const allContents = await testDb.select().from(schema.contents)
    expect(allContents).toHaveLength(0)

    // 历史记录和 slug 历史也应被清空
    const revisions = await testDb.select().from(schema.contentRevisions)
    expect(revisions).toHaveLength(0)
    const slugHist = await testDb.select().from(schema.slugHistories)
    expect(slugHist).toHaveLength(0)
  })

  it('返回导入结果摘要', async () => {
    const results = await importContentData(
      {
        categories: [{ id: 1, name: '分类A', slug: 'a' }],
        tags: [{ id: 1, name: '标签A', slug: 'tag-a' }],
        contents: [],
      },
      1,
    )

    expect(results).toContain('分类: 1 条')
    expect(results).toContain('标签: 1 条')
    // 空数组不出现在结果中
    expect(results.find((r) => r.includes('内容'))).toBeUndefined()
  })

  it('导出后再导入数据一致', async () => {
    await seedContentData()
    const exported = await exportContentData()

    // 清空再导入
    await importContentData(exported, 1)

    const cats = await testDb.select().from(schema.categories)
    expect(cats).toHaveLength(2)
    const allContents = await testDb.select().from(schema.contents)
    expect(allContents).toHaveLength(2) // 文章+页面
    expect(allContents.find((c) => c.type === 'post')?.title).toBe('测试文章')
    expect(allContents.find((c) => c.type === 'page')?.title).toBe('关于')

    // 历史记录和 slug 历史也应恢复
    const revisions = await testDb.select().from(schema.contentRevisions)
    expect(revisions).toHaveLength(1)
    expect(revisions[0].title).toBe('测试文章（旧）')
    const slugHist = await testDb.select().from(schema.slugHistories)
    expect(slugHist).toHaveLength(1)
    expect(slugHist[0].slug).toBe('old-test-post')
  })

  it('导入后自动重算分类/标签的 postCount', async () => {
    await importContentData(
      {
        categories: [
          { id: 1, name: '技术', slug: 'tech' },
          { id: 2, name: '生活', slug: 'life' },
        ],
        tags: [
          { id: 1, name: 'TS', slug: 'ts' },
          { id: 2, name: 'JS', slug: 'js' },
        ],
        contents: [
          {
            id: 1,
            type: 'post',
            title: '已发布',
            slug: 'pub',
            authorId: 1,
            contentRaw: '',
            contentHtml: '',
            contentText: '',
            status: 'published',
            categoryId: 1,
            publishedAt: new Date().toISOString(),
          },
          {
            id: 2,
            type: 'post',
            title: '草稿',
            slug: 'draft',
            authorId: 1,
            contentRaw: '',
            contentHtml: '',
            contentText: '',
            status: 'draft',
            categoryId: 1,
          },
        ],
        contentTags: [
          { contentId: 1, tagId: 1 }, // published + TS
          { contentId: 2, tagId: 2 }, // draft + JS（不应计入）
        ],
      },
      1,
    )

    const cats = await testDb.select().from(schema.categories)
    expect(cats.find((c) => c.slug === 'tech')?.postCount).toBe(1)
    expect(cats.find((c) => c.slug === 'life')?.postCount).toBe(0)

    const tagRows = await testDb.select().from(schema.tags)
    expect(tagRows.find((t) => t.slug === 'ts')?.postCount).toBe(1)
    expect(tagRows.find((t) => t.slug === 'js')?.postCount).toBe(0)
  })

  it('导入内容包含文章和页面', async () => {
    await importContentData(
      {
        categories: [],
        tags: [],
        contents: [
          {
            id: 1,
            type: 'post',
            title: '文章',
            slug: 'post-1',
            authorId: 1,
            contentRaw: 'raw',
            contentHtml: '<p>html</p>',
            contentText: 'text',
            status: 'published',
            createdAt: '2025-01-01T00:00:00.000Z',
          },
          {
            id: 2,
            type: 'page',
            title: '页面',
            path: '/page-1',
            authorId: 1,
            contentRaw: 'raw',
            contentHtml: '<p>html</p>',
            contentText: 'text',
            status: 'published',
            createdAt: '2025-01-01T00:00:00.000Z',
          },
        ],
      },
      1,
    )

    const allContents = await testDb.select().from(schema.contents)
    expect(allContents).toHaveLength(2)
    expect(allContents.find((c) => c.type === 'post')?.title).toBe('文章')
    expect(allContents.find((c) => c.type === 'page')?.title).toBe('页面')
  })

  it('评论子项排在父项前时仍可导入', async () => {
    await importContentData(
      {
        categories: [{ id: 10, name: '技术', slug: 'tech' }],
        tags: [],
        contents: [
          {
            id: 100,
            type: 'post',
            title: '测试文章',
            slug: 'test-post',
            authorId: 1,
            contentRaw: '# Hello',
            contentHtml: '<h1>Hello</h1>',
            contentText: 'Hello',
            status: 'published',
            categoryId: 10,
            allowComment: true,
            showComments: true,
            viewCount: 0,
            pinned: false,
            createdAt: '2025-01-01T00:00:00.000Z',
            updatedAt: '2025-01-01T00:00:00.000Z',
          },
        ],
        contentTags: [],
        comments: [
          {
            id: 201,
            contentId: 100,
            parentId: 200,
            authorName: '子评论',
            content: 'reply',
            status: 'approved',
          },
          { id: 200, contentId: 100, authorName: '父评论', content: 'parent', status: 'approved' },
        ],
        guestbookMessages: [],
        attachments: [],
      },
      1,
    )

    const savedComments = await testDb.select().from(schema.comments)
    expect(savedComments).toHaveLength(2)

    const commentMap = new Map(savedComments.map((item) => [item.id, item]))
    expect(commentMap.get(200)?.parentId).toBeNull()
    expect(commentMap.get(201)?.parentId).toBe(200)
  })

  it('评论随机顺序导入后保持父子关系', async () => {
    await importContentData(
      {
        categories: [{ id: 10, name: '技术', slug: 'tech' }],
        tags: [],
        contents: [
          {
            id: 100,
            type: 'post',
            title: '测试文章',
            slug: 'test-post',
            authorId: 1,
            contentRaw: '# Hello',
            contentHtml: '<h1>Hello</h1>',
            contentText: 'Hello',
            status: 'published',
            categoryId: 10,
            allowComment: true,
            showComments: true,
            viewCount: 0,
            pinned: false,
            createdAt: '2025-01-01T00:00:00.000Z',
            updatedAt: '2025-01-01T00:00:00.000Z',
          },
        ],
        contentTags: [],
        comments: [
          {
            id: 230,
            contentId: 100,
            parentId: 220,
            authorName: '三级评论',
            content: 'level-3',
            status: 'approved',
          },
          {
            id: 240,
            contentId: 100,
            authorName: '另一个顶层',
            content: 'top-2',
            status: 'approved',
          },
          {
            id: 220,
            contentId: 100,
            parentId: 210,
            authorName: '二级评论',
            content: 'level-2',
            status: 'approved',
          },
          {
            id: 210,
            contentId: 100,
            authorName: '一级评论',
            content: 'level-1',
            status: 'approved',
          },
        ],
        guestbookMessages: [],
        attachments: [],
      },
      1,
    )

    const savedComments = await testDb.select().from(schema.comments)
    expect(savedComments).toHaveLength(4)

    const commentMap = new Map(savedComments.map((item) => [item.id, item]))
    expect(commentMap.get(210)?.parentId).toBeNull()
    expect(commentMap.get(220)?.parentId).toBe(210)
    expect(commentMap.get(230)?.parentId).toBe(220)
    expect(commentMap.get(240)?.parentId).toBeNull()
  })

  it('authorId 为空时回填当前用户', async () => {
    await importContentData(
      {
        categories: [{ id: 10, name: '技术', slug: 'tech' }],
        tags: [],
        contents: [
          {
            id: 100,
            type: 'post',
            title: '旧文章',
            slug: 'legacy-post',
            authorId: null,
            contentRaw: '# Hello',
            contentHtml: '<h1>Hello</h1>',
            contentText: null,
            status: 'published',
            categoryId: 10,
            allowComment: true,
            showComments: true,
            viewCount: 0,
            pinned: false,
            createdAt: '2025-01-01T00:00:00.000Z',
            updatedAt: '2025-01-01T00:00:00.000Z',
          },
        ],
        contentTags: [],
        comments: [],
        guestbookMessages: [],
      },
      2,
    )

    const post = await maybeFirst(
      testDb.select().from(schema.contents).where(eq(schema.contents.id, 100)).limit(1),
    )
    expect(post?.authorId).toBe(2)
    expect(post?.contentText).toBe('Hello')
  })

  it('authorId 失效时回填当前用户', async () => {
    await importContentData(
      {
        categories: [{ id: 10, name: '技术', slug: 'tech' }],
        tags: [],
        contents: [
          {
            id: 101,
            type: 'post',
            title: '旧文章 2',
            slug: 'legacy-post-2',
            authorId: 999,
            contentRaw: 'raw content',
            contentHtml: '',
            contentText: '',
            status: 'draft',
            categoryId: 10,
            allowComment: true,
            showComments: true,
            viewCount: 0,
            pinned: false,
            createdAt: '2025-01-01T00:00:00.000Z',
            updatedAt: '2025-01-01T00:00:00.000Z',
          },
        ],
        contentTags: [],
        comments: [],
        guestbookMessages: [],
      },
      1,
    )

    const post = await maybeFirst(
      testDb.select().from(schema.contents).where(eq(schema.contents.id, 101)).limit(1),
    )
    expect(post?.authorId).toBe(1)
    expect(post?.contentText).toBe('raw content')
  })

  it('contentText 为空且无可用内容时写入空字符串', async () => {
    await importContentData(
      {
        categories: [{ id: 10, name: '技术', slug: 'tech' }],
        tags: [],
        contents: [
          {
            id: 102,
            type: 'post',
            title: '空内容文章',
            slug: 'empty-content-post',
            authorId: 1,
            contentRaw: '',
            contentHtml: '',
            contentText: '',
            status: 'draft',
            categoryId: 10,
            allowComment: true,
            showComments: true,
            viewCount: 0,
            pinned: false,
            createdAt: '2025-01-01T00:00:00.000Z',
            updatedAt: '2025-01-01T00:00:00.000Z',
          },
        ],
        contentTags: [],
        comments: [],
        guestbookMessages: [],
      },
      1,
    )

    const post = await maybeFirst(
      testDb.select().from(schema.contents).where(eq(schema.contents.id, 102)).limit(1),
    )
    expect(post?.contentText).toBe('')
  })

  it('保留合法的 authorId 和 contentText', async () => {
    await importContentData(
      {
        categories: [{ id: 10, name: '技术', slug: 'tech' }],
        tags: [],
        contents: [
          {
            id: 103,
            type: 'post',
            title: '标准文章',
            slug: 'normal-post',
            authorId: 2,
            contentRaw: 'raw',
            contentHtml: '<p>html</p>',
            contentText: 'existing text',
            status: 'published',
            categoryId: 10,
            allowComment: true,
            showComments: true,
            viewCount: 0,
            pinned: false,
            createdAt: '2025-01-01T00:00:00.000Z',
            updatedAt: '2025-01-01T00:00:00.000Z',
          },
        ],
        contentTags: [],
        comments: [],
        guestbookMessages: [],
      },
      1,
    )

    const post = await maybeFirst(
      testDb.select().from(schema.contents).where(eq(schema.contents.id, 103)).limit(1),
    )
    expect(post?.authorId).toBe(2)
    expect(post?.contentText).toBe('existing text')
  })

  it('导入历史记录时 createdBy 失效则回填当前用户', async () => {
    await importContentData(
      {
        categories: [],
        tags: [],
        contents: [
          {
            id: 100,
            type: 'post',
            title: '文章',
            slug: 'post-1',
            authorId: 1,
            contentRaw: 'raw',
            contentHtml: '<p>html</p>',
            contentText: 'text',
            status: 'published',
            createdAt: '2025-01-01T00:00:00.000Z',
          },
        ],
        contentRevisions: [
          {
            id: 1,
            targetType: 'post',
            targetId: 100,
            title: '旧标题',
            contentType: 'richtext',
            contentRaw: 'old',
            contentHtml: '<p>old</p>',
            contentText: 'old',
            status: 'published',
            createdBy: 999, // 不存在的用户
            createdAt: '2025-01-01T00:00:00.000Z',
            updatedAt: '2025-01-01T00:00:00.000Z',
          },
        ],
      },
      2,
    )

    const revisions = await testDb.select().from(schema.contentRevisions)
    expect(revisions).toHaveLength(1)
    expect(revisions[0].createdBy).toBe(2) // 回填为当前用户
  })

  it('软删除记录导出再导入后 deletedAt 保持一致', async () => {
    await seedContentData()
    const deletedAt = '2025-06-01T00:00:00.000Z'
    await testDb.update(schema.contents).set({ deletedAt }).where(eq(schema.contents.id, 100))
    await testDb.update(schema.comments).set({ deletedAt }).where(eq(schema.comments.id, 200))

    const exported = await exportContentData()
    await importContentData(exported, 1)

    const post = await maybeFirst(
      testDb.select().from(schema.contents).where(eq(schema.contents.id, 100)).limit(1),
    )
    expect(post?.deletedAt).toBe(deletedAt)

    const page = await maybeFirst(
      testDb.select().from(schema.contents).where(eq(schema.contents.id, 50)).limit(1),
    )
    expect(page?.deletedAt).toBeNull()

    const comment = await maybeFirst(
      testDb.select().from(schema.comments).where(eq(schema.comments.id, 200)).limit(1),
    )
    expect(comment?.deletedAt).toBe(deletedAt)
  })

  it('附件 uploadedBy 引用无效用户时置 null', async () => {
    await importContentData(
      {
        categories: [],
        tags: [],
        contents: [],
        attachments: [
          {
            id: 1,
            filename: 'test.png',
            originalFilename: 'test.png',
            mimeType: 'image/png',
            size: 1024,
            storageProvider: 's3',
            storageKey: 'uploads/test.png',
            uploadedBy: 999, // 不存在的用户
            createdAt: '2025-01-01T00:00:00.000Z',
          },
        ],
      },
      1,
    )

    const rows = await testDb.select().from(schema.attachments)
    expect(rows).toHaveLength(1)
    expect(rows[0].uploadedBy).toBeNull()
  })

  it('评论 userId/moderatedBy 引用无效用户时置 null', async () => {
    await importContentData(
      {
        categories: [],
        tags: [],
        contents: [
          {
            id: 100,
            type: 'post',
            title: '文章',
            slug: 'post-1',
            authorId: 1,
            contentRaw: 'raw',
            contentHtml: '<p>html</p>',
            contentText: 'text',
            status: 'published',
            createdAt: '2025-01-01T00:00:00.000Z',
          },
        ],
        comments: [
          {
            id: 1,
            contentId: 100,
            authorName: '访客',
            content: '评论',
            status: 'approved',
            userId: 999, // 不存在
            moderatedBy: 888, // 不存在
            createdAt: '2025-01-01T00:00:00.000Z',
          },
          {
            id: 2,
            contentId: 100,
            authorName: '管理员',
            content: '回复',
            status: 'approved',
            userId: 1, // 存在
            moderatedBy: 2, // 存在
            createdAt: '2025-01-01T00:00:00.000Z',
          },
        ],
      },
      1,
    )

    const rows = await testDb.select().from(schema.comments)
    expect(rows).toHaveLength(2)

    const invalidComment = rows.find((c) => c.id === 1)!
    expect(invalidComment.userId).toBeNull()
    expect(invalidComment.moderatedBy).toBeNull()

    const validComment = rows.find((c) => c.id === 2)!
    expect(validComment.userId).toBe(1)
    expect(validComment.moderatedBy).toBe(2)
  })
})

describe('importSettingsData', () => {
  it('覆盖导入设置', async () => {
    await seedSettingsData()

    await importSettingsData(
      {
        settings: [{ key: 'siteTitle', value: '新标题' }],
        menus: [],
        users: [],
      },
      1,
    )

    const allSettings = await testDb.select().from(schema.settings)
    const map = Object.fromEntries(allSettings.map((item) => [item.key, item.value]))
    expect(map.siteTitle).toBe('"新标题"')
    expect(map.siteSlogan).toBe('"Yet Another Amazing Blog"')
    expect(map.enableComment).toBe('true')
    expect(map.rssLimit).toBe('20')
  })

  it('导入设置时保留现有敏感字段并忽略导入数据中的敏感字段', async () => {
    // 预设敏感字段（DB 中存 JSON 编码值）
    await testDb.insert(schema.settings).values([
      { key: 'storageS3AccessKey', value: '"EXISTING_KEY"' },
      { key: 'storageS3SecretKey', value: '"EXISTING_SECRET"' },
      { key: 'jwtSecret', value: '"EXISTING_JWT_SECRET"' },
    ])

    await importSettingsData(
      {
        settings: [
          { key: 'siteTitle', value: '新站点' },
          { key: 'storageProvider', value: 's3' },
          // 即使导入数据包含敏感字段，也应被忽略
          { key: 'storageS3AccessKey', value: 'IMPORTED_KEY' },
          { key: 'storageS3SecretKey', value: 'IMPORTED_SECRET' },
          { key: 'jwtSecret', value: 'IMPORTED_JWT_SECRET' },
        ],
      },
      1,
    )

    const allSettings = await testDb.select().from(schema.settings)
    const map = Object.fromEntries(allSettings.map((s) => [s.key, s.value]))
    // 非敏感字段正常导入（DB 中是 JSON 编码）
    expect(map.siteTitle).toBe('"新站点"')
    expect(map.storageProvider).toBe('"s3"')
    // 敏感字段保留原值，不被导入数据覆盖
    expect(map.storageS3AccessKey).toBe('"EXISTING_KEY"')
    expect(map.storageS3SecretKey).toBe('"EXISTING_SECRET"')
    expect(map.jwtSecret).toBe('"EXISTING_JWT_SECRET"')
  })

  it('导入设置时使���原生类型并正确序列化', async () => {
    await importSettingsData(
      {
        settings: [
          { key: 'siteTitle', value: '新站点' },
          { key: 'enableComment', value: false },
          { key: 'rssLimit', value: 20 },
          { key: 'emailNotifyNewComment', value: { enabled: true, userIds: [1] } },
        ],
      },
      1,
    )

    const allSettings = await testDb.select().from(schema.settings)
    const map = Object.fromEntries(allSettings.map((s) => [s.key, s.value]))

    expect(map.siteTitle).toBe('"新站点"')
    expect(map.enableComment).toBe('false')
    expect(map.rssLimit).toBe('20')
    expect(map.emailNotifyNewComment).toBe('{"enabled":true,"userIds":[1]}')
  })

  it('导入设置时忽略未知或废弃设置项', async () => {
    await importSettingsData(
      {
        settings: [
          { key: 'siteTitle', value: '新站点' },
          { key: 'allowThemeToggle', value: true },
          { key: 'legacySetting', value: 'legacy' },
        ],
      },
      1,
    )

    const allSettings = await testDb.select().from(schema.settings)
    const map = Object.fromEntries(allSettings.map((s) => [s.key, s.value]))

    expect(map.siteTitle).toBe('"新站点"')
    expect(map.allowThemeToggle).toBeUndefined()
    expect(map.legacySetting).toBeUndefined()
  })

  it('导入缺失字段时会按默认值补齐并落库', async () => {
    await importSettingsData(
      {
        settings: [{ key: 'siteTitle', value: '测试站' }],
      },
      1,
    )

    const settingsRows = await testDb.select().from(schema.settings)
    const map = Object.fromEntries(settingsRows.map((item) => [item.key, item.value]))
    const [lightTheme] = await testDb
      .select({ id: schema.themes.id })
      .from(schema.themes)
      .where(eq(schema.themes.builtinKey, 'light'))
      .limit(1)

    expect(map.siteTitle).toBe('"测试站"')
    expect(map.siteSlogan).toBe('"Yet Another Amazing Blog"')
    expect(map.enableComment).toBe('true')
    expect(map.showCommentsGlobally).toBe('true')
    expect(map.rssLimit).toBe('20')
    expect(map.guestbookWelcome).toBe('"欢迎给我留言！"')
    expect(map.emailSmtpEncryption).toBe('"tls"')
    expect(map.emailNotifyNewComment).toBe('{"enabled":false,"userIds":[]}')
    expect(map.activeCustomStyleIds).toBe('[]')
    expect(map.activeThemeId).toBe(String(lightTheme?.id))
  })

  it('覆盖导入菜单和跳转规则', async () => {
    await seedSettingsData()

    await importSettingsData(
      {
        settings: [],
        menus: [
          { id: 1, title: '新菜单', url: '/new' },
          { id: 2, title: '菜单2', url: '/menu2' },
        ],
        redirectRules: [
          {
            id: 5,
            sortOrder: 2,
            pathRegex: '^/legacy$',
            redirectTo: '/new',
            redirectType: '302',
            memo: '旧地址',
          },
          {
            id: 4,
            sortOrder: 1,
            pathRegex: '^/archive$',
            redirectTo: '/posts',
            redirectType: '301',
            memo: null,
          },
        ],
        users: [],
      },
      1,
    )

    const allMenus = await testDb.select().from(schema.menus)
    expect(allMenus).toHaveLength(2)

    const allRedirectRules = await testDb
      .select()
      .from(schema.redirectRules)
      .orderBy(asc(schema.redirectRules.sortOrder))
    expect(allRedirectRules).toHaveLength(2)
    expect(allRedirectRules[0].pathRegex).toBe('^/archive$')
    expect(allRedirectRules[0].sortOrder).toBe(1)
    expect(allRedirectRules[1].pathRegex).toBe('^/legacy$')
    expect(allRedirectRules[1].sortOrder).toBe(2)
  })

  it('菜单父子关系导入（拓扑排序）', async () => {
    await importSettingsData(
      {
        settings: [],
        menus: [
          { id: 2, title: '子菜单', url: '/child', parentId: 1 },
          { id: 1, title: '父菜单', url: '/parent' },
        ],
      },
      1,
    )

    const allMenus = await testDb.select().from(schema.menus)
    expect(allMenus).toHaveLength(2)
    const menuMap = new Map(allMenus.map((m) => [m.id, m]))
    expect(menuMap.get(1)?.parentId).toBeNull()
    expect(menuMap.get(2)?.parentId).toBe(1)
  })

  it('导入非法跳转规则时会拒绝整个导入', async () => {
    await seedSettingsData()

    await expect(
      importSettingsData(
        {
          settings: [],
          redirectRules: [
            {
              id: 1,
              sortOrder: 1,
              pathRegex: '^/legacy$',
              redirectTo: 'javascript:alert(1)',
              redirectType: '301',
            },
          ],
        },
        1,
      ),
    ).rejects.toMatchObject({ code: 'INVALID_REDIRECT_TO' })

    const allRedirectRules = await testDb.select().from(schema.redirectRules)
    expect(allRedirectRules).toHaveLength(1)
    expect(allRedirectRules[0].pathRegex).toBe('^/old/(\\d+)$')
  })

  it('导入已存在的用户不修改密码', async () => {
    // 获取原始密码 hash
    const before = await testDb.select().from(schema.users)
    const adminHash = before.find((u) => u.username === 'admin')!.passwordHash

    await importSettingsData(
      {
        settings: [],
        users: [{ username: 'admin', email: 'new@example.com', role: 'owner' }],
      },
      1,
    )

    const after = await testDb.select().from(schema.users)
    const admin = after.find((u) => u.username === 'admin')!
    // 密码未变
    expect(admin.passwordHash).toBe(adminHash)
    // 邮箱已更新
    expect(admin.email).toBe('new@example.com')
  })

  it('导入时不修改当前操作用户的角色', async () => {
    // 用户 1 (admin) 是站长，导入数据试图将其改为 editor
    await importSettingsData(
      {
        settings: [],
        users: [{ username: 'admin', email: 'changed@example.com', role: 'editor' }],
      },
      1,
    ) // currentUserId = 1

    const admin = (await testDb.select().from(schema.users)).find((u) => u.username === 'admin')!
    // 角色未变
    expect(admin.role).toBe('owner')
    // 邮箱已更新
    expect(admin.email).toBe('changed@example.com')
  })

  it('导入不存在的用户生成随机密码', async () => {
    await importSettingsData(
      {
        settings: [],
        users: [{ username: 'newuser', email: 'new@test.com', role: 'editor' }],
      },
      1,
    )

    const allUsers = await testDb.select().from(schema.users)
    const newUser = allUsers.find((u) => u.username === 'newuser')
    expect(newUser).toBeDefined()
    expect(newUser!.email).toBe('new@test.com')
    expect(newUser!.role).toBe('editor')
    // 密码不为空且经过哈希
    expect(newUser!.passwordHash).toBeDefined()
    expect(newUser!.passwordHash.length).toBeGreaterThan(10)
  })

  it('跳过没有 username 的用户', async () => {
    const beforeCount = (await testDb.select().from(schema.users)).length

    await importSettingsData(
      {
        settings: [],
        users: [{ email: 'no-name@test.com', role: 'editor' }],
      },
      1,
    )

    const afterCount = (await testDb.select().from(schema.users)).length
    expect(afterCount).toBe(beforeCount)
  })

  it('返回导入结果摘要', async () => {
    const results = await importSettingsData(
      {
        settings: [
          { key: 'siteTitle', value: 'v1' },
          { key: 'allowThemeToggle', value: true },
        ],
        menus: [{ id: 1, title: '菜单', url: '/' }],
        redirectRules: [
          { id: 1, sortOrder: 1, pathRegex: '^/old$', redirectTo: '/new', redirectType: '301' },
        ],
        users: [
          { username: 'admin', role: 'owner' },
          { username: 'brand-new', role: 'editor' },
        ],
      },
      1,
    )

    expect(results.find((r) => r.startsWith('设置: 1 条'))).toContain('默认补齐')
    expect(results).toContain('菜单: 1 条')
    expect(results).toContain('跳转规则: 1 条')
    expect(results.find((r) => r.includes('用户'))).toContain('新建 1 个')
    expect(results.find((r) => r.includes('用户'))).toContain('更新 1 个')
  })

  it('导入覆盖 themes 与 customStyles，并补齐内置主题', async () => {
    // 预置一条自定义主题，期望导入后被清空
    await testDb
      .insert(schema.themes)
      .values([{ id: 800, name: '旧主题', css: 'body{}', sortOrder: 1, builtinKey: null }])

    await importSettingsData(
      {
        settings: [
          { key: 'activeThemeId', value: 500 },
          { key: 'activeCustomStyleIds', value: [600] },
        ],
        themes: [
          { id: 500, name: '新主题', css: 'body{color:#000}', sortOrder: 10, builtinKey: null },
        ],
        customStyles: [{ id: 600, name: '自定义片段', css: '.x{}', sortOrder: 1 }],
      },
      1,
    )

    const allThemes = await testDb.select().from(schema.themes)
    // 三个内置主题 + 导入的 1 个自定义主题
    expect(allThemes.find((t) => t.id === 500)?.name).toBe('新主题')
    expect(allThemes.find((t) => t.id === 800)).toBeUndefined()
    expect(allThemes.filter((t) => t.builtinKey !== null)).toHaveLength(3)

    const allCustomStyles = await testDb.select().from(schema.customStyles)
    expect(allCustomStyles).toHaveLength(1)
    expect(allCustomStyles[0].id).toBe(600)

    // activeThemeId / activeCustomStyleIds 指向新插入的主题 id
    const settingsRows = await testDb.select().from(schema.settings)
    const active = settingsRows.find((s) => s.key === 'activeThemeId')
    expect(active?.value).toBe('500')
    const ids = settingsRows.find((s) => s.key === 'activeCustomStyleIds')
    expect(ids?.value).toBe('[600]')
  })

  it('导入数据缺失 themes 时自动补齐内置主题', async () => {
    await importSettingsData(
      {
        settings: [{ key: 'siteTitle', value: '测试站' }],
      },
      1,
    )

    const builtin = await testDb
      .select()
      .from(schema.themes)
      .where(eq(schema.themes.builtinKey, 'light'))
    expect(builtin).toHaveLength(1)
  })

  it('导出后再导入设置数据一致', async () => {
    await testDb.insert(schema.settings).values([
      { key: 'siteTitle', value: '"我的博客"' },
      { key: 'enableComment', value: 'false' },
      { key: 'rssLimit', value: '20' },
      { key: 'emailNotifyNewComment', value: '{"enabled":true,"userIds":[1]}' },
    ])
    await testDb.insert(schema.menus).values([{ id: 60, title: '首页', url: '/' }])
    await testDb.insert(schema.redirectRules).values([
      {
        id: 70,
        sortOrder: 1,
        pathRegex: '^/old/(\\d+)$',
        redirectTo: '/posts/$1',
        redirectType: '301',
        memo: '旧路径跳转',
      },
    ])

    const exported = await exportSettingsData()

    await importSettingsData(exported, 1)

    const allSettings = await testDb.select().from(schema.settings)
    expect(allSettings.length).toBeGreaterThanOrEqual(4)
    expect(allSettings.find((s) => s.key === 'siteTitle')?.value).toBe('"我的博客"')
    expect(allSettings.find((s) => s.key === 'enableComment')?.value).toBe('false')
    expect(allSettings.find((s) => s.key === 'rssLimit')?.value).toBe('20')
    expect(allSettings.find((s) => s.key === 'emailNotifyNewComment')?.value).toBe(
      '{"enabled":true,"userIds":[1]}',
    )
    expect(allSettings.find((s) => s.key === 'siteSlogan')?.value).toBe(
      '"Yet Another Amazing Blog"',
    )

    const allRedirectRules = await testDb.select().from(schema.redirectRules)
    expect(allRedirectRules).toHaveLength(1)
    expect(allRedirectRules[0].pathRegex).toBe('^/old/(\\d+)$')
  })
})
