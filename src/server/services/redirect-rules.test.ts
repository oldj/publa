import { beforeEach, describe, expect, it } from 'vitest'
import { setupTestDb } from './__test__/setup'

const {
  createRedirectRule,
  deleteRedirectRule,
  listRedirectRules,
  matchRedirectRule,
  reorderRedirectRules,
} = await import('./redirect-rules')

beforeEach(async () => {
  await setupTestDb()
})

describe('redirect-rules service', () => {
  it('按顺序匹配第一条命中的规则', async () => {
    await createRedirectRule({
      pathRegex: '^/old/(\\d+)$',
      redirectTo: '/posts/$1',
      redirectType: '301',
      memo: '精确规则',
    })
    await createRedirectRule({
      pathRegex: '^/old/.*$',
      redirectTo: '/archive',
      redirectType: '302',
      memo: '兜底规则',
    })

    const matched = await matchRedirectRule('/old/123')

    expect(matched).toEqual({
      destination: '/posts/123',
      redirectType: '301',
      permanent: true,
      ruleId: 1,
    })
  })

  it('完全不存在的路径也能命中规则', async () => {
    await createRedirectRule({
      pathRegex: '^/path/not/exist/(\\d+)$',
      redirectTo: 'https://example.com/legacy/$1',
      redirectType: '302',
      memo: null,
    })

    const matched = await matchRedirectRule('/path/not/exist/456')

    expect(matched?.destination).toBe('https://example.com/legacy/456')
    expect(matched?.permanent).toBe(false)
  })

  it('命中后会替换捕获组', async () => {
    await createRedirectRule({
      pathRegex: '^/old/(\\d+)/(\\w+)$',
      redirectTo: '/posts/$2-$1',
      redirectType: '308',
      memo: null,
    })

    const matched = await matchRedirectRule('/old/12/hello')

    expect(matched?.destination).toBe('/posts/hello-12')
    expect(matched?.redirectType).toBe('308')
    expect(matched?.permanent).toBe(true)
  })

  it('无效正则会在保存时被拒绝', async () => {
    await expect(
      createRedirectRule({
        pathRegex: '([unclosed',
        redirectTo: '/target',
        redirectType: '301',
        memo: null,
      }),
    ).rejects.toMatchObject({ code: 'INVALID_PATH_REGEX' })
  })

  it('无效跳转目标会在保存时被拒绝', async () => {
    await expect(
      createRedirectRule({
        pathRegex: '^/old$',
        redirectTo: 'javascript:alert(1)',
        redirectType: '301',
        memo: null,
      }),
    ).rejects.toMatchObject({ code: 'INVALID_REDIRECT_TO' })
  })

  it('直接自循环规则会被跳过', async () => {
    await createRedirectRule({
      pathRegex: '^/same$',
      redirectTo: '/same',
      redirectType: '301',
      memo: null,
    })
    await createRedirectRule({
      pathRegex: '^/same$',
      redirectTo: '/other',
      redirectType: '302',
      memo: null,
    })

    const matched = await matchRedirectRule('/same')

    expect(matched?.destination).toBe('/other')
    expect(matched?.ruleId).toBe(2)
  })

  it('捕获组替换后若生成非法目标会跳过该规则', async () => {
    await createRedirectRule({
      pathRegex: '^/legacy/(.+)$',
      redirectTo: '/$1',
      redirectType: '301',
      memo: null,
    })
    await createRedirectRule({
      pathRegex: '^/legacy/(.+)$',
      redirectTo: '/safe-target',
      redirectType: '302',
      memo: null,
    })

    const matched = await matchRedirectRule('/legacy//evil.com')

    expect(matched?.destination).toBe('/safe-target')
    expect(matched?.ruleId).toBe(2)
  })

  it('外部 URL 模板的捕获组可以正常替换', async () => {
    await createRedirectRule({
      pathRegex: '^/go/(.+)$',
      redirectTo: 'https://example.com/$1',
      redirectType: '302',
      memo: null,
    })

    const matched = await matchRedirectRule('/go/page')

    expect(matched?.destination).toBe('https://example.com/page')
  })

  it('删除后会压实排序', async () => {
    await createRedirectRule({
      pathRegex: '^/a$',
      redirectTo: '/b',
      redirectType: '301',
      memo: null,
    })
    const second = await createRedirectRule({
      pathRegex: '^/c$',
      redirectTo: '/d',
      redirectType: '301',
      memo: null,
    })
    await createRedirectRule({
      pathRegex: '^/e$',
      redirectTo: '/f',
      redirectType: '301',
      memo: null,
    })

    await deleteRedirectRule(second.id)

    const rules = await listRedirectRules()
    expect(rules.map((item) => item.order)).toEqual([1, 2])
  })

  it('拖拽重排后顺序会持久化', async () => {
    const first = await createRedirectRule({
      pathRegex: '^/a$',
      redirectTo: '/a-1',
      redirectType: '301',
      memo: null,
    })
    const second = await createRedirectRule({
      pathRegex: '^/b$',
      redirectTo: '/b-1',
      redirectType: '301',
      memo: null,
    })
    const third = await createRedirectRule({
      pathRegex: '^/c$',
      redirectTo: '/c-1',
      redirectType: '301',
      memo: null,
    })

    await reorderRedirectRules([third.id, first.id, second.id])

    const rules = await listRedirectRules()
    expect(rules.map((item) => ({ id: item.id, order: item.order }))).toEqual([
      { id: third.id, order: 1 },
      { id: first.id, order: 2 },
      { id: second.id, order: 3 },
    ])
  })

  it('无规则时 matchRedirectRule 返回 null', async () => {
    const matched = await matchRedirectRule('/anything')
    expect(matched).toBeNull()
  })

  it('路径中的 query 和 hash 会被忽略', async () => {
    await createRedirectRule({
      pathRegex: '^/old$',
      redirectTo: '/new',
      redirectType: '301',
      memo: null,
    })

    const matched = await matchRedirectRule('/old?foo=1#bar')
    expect(matched?.destination).toBe('/new')
  })

  it('协议相对路径 // 会被拒绝', async () => {
    await expect(
      createRedirectRule({
        pathRegex: '^/test$',
        redirectTo: '//evil.com',
        redirectType: '301',
        memo: null,
      }),
    ).rejects.toMatchObject({ code: 'INVALID_REDIRECT_TO' })
  })

  it('updateRedirectRule 可以更新已有规则', async () => {
    const { updateRedirectRule } = await import('./redirect-rules')

    const created = await createRedirectRule({
      pathRegex: '^/old$',
      redirectTo: '/new',
      redirectType: '301',
      memo: null,
    })

    const updated = await updateRedirectRule(created.id, {
      pathRegex: '^/changed$',
      redirectTo: '/target',
      redirectType: '302',
      memo: '已更新',
    })

    expect(updated).not.toBeNull()
    expect(updated!.pathRegex).toBe('^/changed$')
    expect(updated!.redirectTo).toBe('/target')
    expect(updated!.redirectType).toBe('302')
    expect(updated!.memo).toBe('已更新')
  })

  it('updateRedirectRule 对不存在的 id 返回 null', async () => {
    const { updateRedirectRule } = await import('./redirect-rules')

    const result = await updateRedirectRule(99999, {
      pathRegex: '^/x$',
      redirectTo: '/y',
      redirectType: '301',
      memo: null,
    })

    expect(result).toBeNull()
  })

  it('reorderRedirectRules 传入非法 ids 会被拒绝', async () => {
    await createRedirectRule({
      pathRegex: '^/a$',
      redirectTo: '/b',
      redirectType: '301',
      memo: null,
    })

    // ids 数量不匹配
    await expect(reorderRedirectRules([1, 2])).rejects.toMatchObject({
      code: 'INVALID_REORDER_IDS',
    })

    // 包含不存在的 id
    await expect(reorderRedirectRules([999])).rejects.toMatchObject({
      code: 'INVALID_REORDER_IDS',
    })
  })

  it('307 临时跳转不标记为永久', async () => {
    await createRedirectRule({
      pathRegex: '^/temp$',
      redirectTo: '/dest',
      redirectType: '307',
      memo: null,
    })

    const matched = await matchRedirectRule('/temp')
    expect(matched?.redirectType).toBe('307')
    expect(matched?.permanent).toBe(false)
  })
})
