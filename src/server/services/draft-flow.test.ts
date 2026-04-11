import { beforeEach, describe, expect, it } from 'vitest'
import { setupTestDb } from './__test__/setup'

const { createEmptyPost, listPostsAdmin, updatePost } = await import('./posts')
const { createEmptyPage, createPage, listPages } = await import('./pages')
const { saveDraft, getDraft, publishDraft, listPublishedRevisions } = await import('./revisions')

beforeEach(async () => {
  await setupTestDb()
})

describe('createEmptyPost', () => {
  it('创建空草稿文章', async () => {
    const post = await createEmptyPost(1)
    expect(post).toBeDefined()
    expect(post.type).toBe('post')
    expect(post.title).toBe('')
    expect(post.slug).toBeNull()
    expect(post.status).toBe('draft')
    expect(post.authorId).toBe(1)
  })

  it('多个空草稿共存（null slug 不冲突）', async () => {
    const a = await createEmptyPost(1)
    const b = await createEmptyPost(1)
    expect(a.id).not.toBe(b.id)
    expect(a.slug).toBeNull()
    expect(b.slug).toBeNull()
  })
})

describe('createEmptyPage', () => {
  it('创建空草稿页面', async () => {
    const page = await createEmptyPage()
    expect(page).toBeDefined()
    expect(page.type).toBe('page')
    expect(page.title).toBe('')
    expect(page.path).toBeNull()
    expect(page.template).toBe('default')
    expect(page.status).toBe('draft')
  })

  it('多个空草稿页面共存（null path 不冲突）', async () => {
    const a = await createEmptyPage()
    const b = await createEmptyPage()
    expect(a.id).not.toBe(b.id)
    expect(a.path).toBeNull()
    expect(b.path).toBeNull()
  })
})

describe('草稿保存无需必填字段', () => {
  it('空草稿文章可保存草稿内容', async () => {
    const post = await createEmptyPost(1)
    const result = await saveDraft(
      'post',
      post.id,
      {
        title: '草稿标题',
        excerpt: '',
        contentRaw: '# Hello',
        contentHtml: '<h1>Hello</h1>',
        contentText: 'Hello',
        metadata: {
          slug: 'duplicate-slug',
          categoryId: null,
          tagNames: ['前端'],
          seoTitle: 'SEO',
          seoDescription: 'Desc',
        },
      },
      1,
    )
    expect(result.updatedAt).toBeDefined()

    const draft = await getDraft('post', post.id)
    expect(draft).not.toBeNull()
    expect(draft!.title).toBe('草稿标题')
    expect(draft!.contentRaw).toBe('# Hello')
    expect(draft!.metadata).toMatchObject({
      slug: 'duplicate-slug',
      tagNames: ['前端'],
    })
  })

  it('空草稿页面可保存草稿内容', async () => {
    const page = await createEmptyPage()
    const result = await saveDraft(
      'page',
      page.id,
      {
        title: '页面草稿',
        excerpt: '',
        contentRaw: '<p>page content</p>',
        contentHtml: '<p>page content</p>',
        contentText: 'page content',
        metadata: {
          path: 'invalid/path/',
          template: 'blank',
          seoTitle: '页面 SEO',
          seoDescription: '页面描述',
        },
      },
      1,
    )
    expect(result.updatedAt).toBeDefined()

    const draft = await getDraft('page', page.id)
    expect(draft).not.toBeNull()
    expect(draft!.title).toBe('页面草稿')
    expect(draft!.contentRaw).toBe('<p>page content</p>')
    expect(draft!.metadata).toMatchObject({
      path: 'invalid/path/',
      template: 'blank',
    })
  })
})

describe('A/B 文章各自草稿互不干扰', () => {
  it('两篇文章各自保存草稿互不覆盖', async () => {
    const postA = await createEmptyPost(1)
    const postB = await createEmptyPost(1)

    await saveDraft(
      'post',
      postA.id,
      { title: '文章 A', excerpt: '', contentRaw: 'A 内容', contentHtml: '', contentText: '' },
      1,
    )
    await saveDraft(
      'post',
      postB.id,
      { title: '文章 B', excerpt: '', contentRaw: 'B 内容', contentHtml: '', contentText: '' },
      1,
    )

    const draftA = await getDraft('post', postA.id)
    const draftB = await getDraft('post', postB.id)
    expect(draftA!.title).toBe('文章 A')
    expect(draftA!.contentRaw).toBe('A 内容')
    expect(draftB!.title).toBe('文章 B')
    expect(draftB!.contentRaw).toBe('B 内容')
  })
})

describe('发布后草稿冻结为历史，新草稿可继续保存', () => {
  it('发布后再编辑产生新草稿，历史版本不受影响', async () => {
    const post = await createEmptyPost(1)

    // 填写内容并发布
    await updatePost(post.id, {
      title: '发布标题',
      slug: 'published-slug',
      status: 'published',
      contentRaw: '第一版',
      contentHtml: '<p>第一版</p>',
      contentText: '第一版',
    })

    // 保存草稿并发布，产生历史版本
    await saveDraft(
      'post',
      post.id,
      {
        title: '发布标题',
        excerpt: '',
        contentRaw: '第一版',
        contentHtml: '<p>第一版</p>',
        contentText: '第一版',
      },
      1,
    )
    await publishDraft('post', post.id, 1)

    // 发布后，草稿应已被冻结
    expect(await getDraft('post', post.id)).toBeNull()
    const revisions = await listPublishedRevisions('post', post.id)
    expect(revisions).toHaveLength(1)

    // 再次编辑保存新草稿
    await saveDraft(
      'post',
      post.id,
      {
        title: '修改标题',
        excerpt: '',
        contentRaw: '第二版',
        contentHtml: '<p>第二版</p>',
        contentText: '第二版',
      },
      1,
    )

    // 新草稿和历史版本共存
    const newDraft = await getDraft('post', post.id)
    expect(newDraft!.contentRaw).toBe('第二版')
    expect(await listPublishedRevisions('post', post.id)).toHaveLength(1)
  })
})

describe('后台列表应叠加 draft 快照字段', () => {
  it('文章列表应显示 draft 标题', async () => {
    const post = await createEmptyPost(1)

    await saveDraft(
      'post',
      post.id,
      {
        title: '只存在于草稿里的标题',
        excerpt: '',
        contentRaw: '内容',
        contentHtml: '<p>内容</p>',
        contentText: '内容',
      },
      1,
    )

    const result = await listPostsAdmin()
    expect(result.items[0]?.title).toBe('只存在于草稿里的标题')
  })

  it('页面列表应显示 draft 的标题、路径和内容类型', async () => {
    const page = await createEmptyPage()

    await saveDraft(
      'page',
      page.id,
      {
        title: '只存在于草稿里的页面标题',
        excerpt: '',
        contentType: 'markdown',
        contentRaw: '# Draft Page',
        contentHtml: '<h1>Draft Page</h1>',
        contentText: 'Draft Page',
        metadata: {
          path: 'invalid/path/',
          template: 'blank',
          seoTitle: '',
          seoDescription: '',
        },
      },
      1,
    )

    const result = await listPages()
    expect(result.items[0]?.title).toBe('只存在于草稿里的页面标题')
    expect(result.items[0]?.path).toBe('invalid/path/')
    expect(result.items[0]?.template).toBe('blank')
    expect(result.items[0]?.contentType).toBe('markdown')
  })
})

describe('后台搜索应匹配 draft 标题', () => {
  it('搜索草稿标题能命中未发布的文章', async () => {
    const post = await createEmptyPost(1)

    // 主表标题为空，只在草稿里有标题
    await saveDraft(
      'post',
      post.id,
      {
        title: '独特的草稿标题',
        excerpt: '',
        contentRaw: '内容',
        contentHtml: '<p>内容</p>',
        contentText: '内容',
      },
      1,
    )

    // 搜索草稿标题
    const result = await listPostsAdmin({ search: '独特的草稿' })
    expect(result.items).toHaveLength(1)
    expect(result.items[0]?.title).toBe('独特的草稿标题')
  })

  it('搜索主表标题仍然有效', async () => {
    const post = await createEmptyPost(1)
    await updatePost(post.id, { title: '正式标题', slug: 'slug-1', status: 'published' })

    const result = await listPostsAdmin({ search: '正式标题' })
    expect(result.items).toHaveLength(1)
  })

  it('无匹配时返回空列表', async () => {
    await createEmptyPost(1)
    const result = await listPostsAdmin({ search: '不存在的关键词' })
    expect(result.items).toHaveLength(0)
  })
})

describe('转为草稿（下线）', () => {
  it('已发布文章可以转为草稿状态', async () => {
    const post = await createEmptyPost(1)
    await updatePost(post.id, {
      title: '已发布',
      slug: 'pub-slug',
      status: 'published',
      contentRaw: '正文',
      contentHtml: '<p>正文</p>',
      contentText: '正文',
    })

    // 转为草稿
    const result = await updatePost(post.id, { status: 'draft' })
    expect(result).not.toBeNull()
    expect(result!.status).toBe('draft')
  })

  it('转为草稿不影响已有历史版本', async () => {
    const post = await createEmptyPost(1)
    await updatePost(post.id, {
      title: '已发布',
      slug: 'pub-slug-2',
      status: 'published',
      contentRaw: '正文',
      contentHtml: '<p>正文</p>',
      contentText: '正文',
    })

    // 创建历史版本
    await saveDraft(
      'post',
      post.id,
      {
        title: '已发布',
        excerpt: '',
        contentRaw: '正文',
        contentHtml: '<p>正文</p>',
        contentText: '正文',
      },
      1,
    )
    await publishDraft('post', post.id, 1)

    // 转为草稿
    await updatePost(post.id, { status: 'draft' })

    // 历史版本不受影响
    const revisions = await listPublishedRevisions('post', post.id)
    expect(revisions).toHaveLength(1)
  })
})

describe('statusCounts', () => {
  it('文章列表返回各状态计数', async () => {
    // 创建不同状态的文章
    await createEmptyPost(1)
    await createEmptyPost(1)
    const pub = await createEmptyPost(1)
    await updatePost(pub.id, { title: '已发布', slug: 'pub-1', status: 'published' })

    const result = await listPostsAdmin()
    expect(result.statusCounts).toEqual({ draft: 2, scheduled: 0, published: 1 })
  })

  it('文章状态筛选不影响 statusCounts', async () => {
    await createEmptyPost(1)
    const pub = await createEmptyPost(1)
    await updatePost(pub.id, { title: '已发布', slug: 'pub-2', status: 'published' })

    const result = await listPostsAdmin({ status: 'draft' })
    expect(result.items).toHaveLength(1)
    expect(result.statusCounts).toEqual({ draft: 1, scheduled: 0, published: 1 })
  })

  it('页面列表返回各状态计数', async () => {
    await createEmptyPage()
    await createPage({
      title: '已发布页面',
      path: 'about',
      contentRaw: '',
      contentHtml: '',
      status: 'published',
    })

    const result = await listPages()
    expect(result.statusCounts).toEqual({ draft: 1, scheduled: 0, published: 1 })
  })

  it('页面状态筛选不影响 statusCounts', async () => {
    await createEmptyPage()
    await createPage({
      title: '已发布页面',
      path: 'about-2',
      contentRaw: '',
      contentHtml: '',
      status: 'published',
    })

    const result = await listPages({ status: 'published' })
    expect(result.items).toHaveLength(1)
    expect(result.statusCounts).toEqual({ draft: 1, scheduled: 0, published: 1 })
  })
})

describe('文章搜索 slug', () => {
  it('搜索 slug 能命中文章', async () => {
    const post = await createEmptyPost(1)
    await updatePost(post.id, { title: '标题', slug: 'my-unique-slug', status: 'published' })

    const result = await listPostsAdmin({ search: 'unique-slug' })
    expect(result.items).toHaveLength(1)
    expect(result.items[0]?.slug).toBe('my-unique-slug')
  })

  it('slug 搜索不影响 statusCounts', async () => {
    const post = await createEmptyPost(1)
    await updatePost(post.id, { title: '标题', slug: 'slug-x', status: 'published' })
    await createEmptyPost(1) // 一篇草稿，不会被搜索命中

    const result = await listPostsAdmin({ search: 'slug-x' })
    expect(result.items).toHaveLength(1)
    // statusCounts 只反映搜索结果范围内的计数
    expect(result.statusCounts.published).toBe(1)
    expect(result.statusCounts.draft).toBe(0)
  })
})

describe('页面搜索', () => {
  it('搜索标题能命中页面', async () => {
    await createPage({
      title: '关于我们',
      path: 'about',
      contentRaw: '',
      contentHtml: '',
      status: 'published',
    })

    const result = await listPages({ search: '关于' })
    expect(result.items).toHaveLength(1)
    expect(result.items[0]?.title).toBe('关于我们')
  })

  it('搜索路径能命中页面', async () => {
    await createPage({
      title: '联系方式',
      path: 'contact-us',
      contentRaw: '',
      contentHtml: '',
      status: 'published',
    })

    const result = await listPages({ search: 'contact' })
    expect(result.items).toHaveLength(1)
    expect(result.items[0]?.path).toBe('contact-us')
  })

  it('无匹配时返回空列表', async () => {
    await createEmptyPage()
    const result = await listPages({ search: '不存在的关键词' })
    expect(result.items).toHaveLength(0)
  })

  it('搜索草稿标题能命中页面', async () => {
    const page = await createEmptyPage()
    await saveDraft(
      'page',
      page.id,
      {
        title: '草稿页面标题',
        excerpt: '',
        contentRaw: '<p>内容</p>',
        contentHtml: '<p>内容</p>',
        contentText: '内容',
        metadata: { path: 'draft-page', template: 'default' },
      },
      1,
    )

    const result = await listPages({ search: '草稿页面' })
    expect(result.items).toHaveLength(1)
  })
})
