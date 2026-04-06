import { beforeEach, describe, expect, it } from 'vitest'
import { setupTestDb } from './__test__/setup'

const { listMenus, getMenuTree, createMenu, updateMenu, deleteMenu, reorderMenus, resetMenus } =
  await import('./menus')

beforeEach(async () => {
  await setupTestDb()
})

describe('menus service', () => {
  // ─── CRUD ───

  it('初始状态无菜单', async () => {
    const list = await listMenus()
    expect(list).toHaveLength(0)
  })

  it('创建菜单并返回完整记录', async () => {
    const menu = await createMenu({ title: '首页', url: '/' })

    expect(menu.id).toBeDefined()
    expect(menu.title).toBe('首页')
    expect(menu.url).toBe('/')
    expect(menu.parentId).toBeNull()
    expect(menu.sortOrder).toBe(0)
    expect(menu.target).toBe('_self')
    expect(menu.hidden).toBe(0)
  })

  it('创建菜单时可指定各字段', async () => {
    const menu = await createMenu({
      title: '外部链接',
      url: 'https://example.com',
      sortOrder: 5,
      target: '_blank',
      hidden: 1,
    })

    expect(menu.target).toBe('_blank')
    expect(menu.sortOrder).toBe(5)
    expect(menu.hidden).toBe(1)
  })

  it('更新菜单字段', async () => {
    const created = await createMenu({ title: '旧标题', url: '/old' })
    const updated = await updateMenu(created.id, { title: '新标题', url: '/new' })

    expect(updated!.title).toBe('新标题')
    expect(updated!.url).toBe('/new')
  })

  it('更新菜单 hidden 字段', async () => {
    const created = await createMenu({ title: '测试', url: '/test' })
    expect(created.hidden).toBe(0)

    const updated = await updateMenu(created.id, { hidden: 1 })
    expect(updated!.hidden).toBe(1)

    const restored = await updateMenu(created.id, { hidden: 0 })
    expect(restored!.hidden).toBe(0)
  })

  it('删除菜单', async () => {
    const menu = await createMenu({ title: '待删除', url: '/del' })
    await deleteMenu(menu.id)

    const list = await listMenus()
    expect(list).toHaveLength(0)
  })

  // ─── 父子关系 ───

  it('创建子菜单', async () => {
    const parent = await createMenu({ title: '父菜单', url: '/parent' })
    const child = await createMenu({ title: '子菜单', url: '/child', parentId: parent.id })

    expect(child.parentId).toBe(parent.id)
  })

  it('删除父菜单会级联删除子菜单', async () => {
    const parent = await createMenu({ title: '父', url: '/p' })
    await createMenu({ title: '子1', url: '/c1', parentId: parent.id })
    await createMenu({ title: '子2', url: '/c2', parentId: parent.id })

    await deleteMenu(parent.id)

    const list = await listMenus()
    expect(list).toHaveLength(0)
  })

  it('删除子菜单不影响父菜单和兄弟菜单', async () => {
    const parent = await createMenu({ title: '父', url: '/p' })
    const child1 = await createMenu({ title: '子1', url: '/c1', parentId: parent.id })
    await createMenu({ title: '子2', url: '/c2', parentId: parent.id })

    await deleteMenu(child1.id)

    const list = await listMenus()
    expect(list).toHaveLength(2)
    expect(list.map((m) => m.title)).toContain('父')
    expect(list.map((m) => m.title)).toContain('子2')
  })

  // ─── 排序 ───

  it('listMenus 按 sortOrder 排序', async () => {
    await createMenu({ title: 'C', url: '/c', sortOrder: 2 })
    await createMenu({ title: 'A', url: '/a', sortOrder: 0 })
    await createMenu({ title: 'B', url: '/b', sortOrder: 1 })

    const list = await listMenus()
    expect(list.map((m) => m.title)).toEqual(['A', 'B', 'C'])
  })

  it('reorderMenus 批量更新排序', async () => {
    const a = await createMenu({ title: 'A', url: '/a', sortOrder: 0 })
    const b = await createMenu({ title: 'B', url: '/b', sortOrder: 1 })
    const c = await createMenu({ title: 'C', url: '/c', sortOrder: 2 })

    await reorderMenus([
      { id: c.id, sortOrder: 0 },
      { id: a.id, sortOrder: 1 },
      { id: b.id, sortOrder: 2 },
    ])

    const list = await listMenus()
    expect(list.map((m) => m.title)).toEqual(['C', 'A', 'B'])
  })

  // ─── 菜单树 ───

  it('getMenuTree 返回树形结构', async () => {
    const parent = await createMenu({ title: '导航', url: '', sortOrder: 0 })
    await createMenu({ title: '子项1', url: '/s1', parentId: parent.id, sortOrder: 0 })
    await createMenu({ title: '子项2', url: '/s2', parentId: parent.id, sortOrder: 1 })
    await createMenu({ title: '顶级', url: '/top', sortOrder: 1 })

    const tree = await getMenuTree()

    expect(tree).toHaveLength(2)
    expect(tree[0].title).toBe('导航')
    expect(tree[0].children).toHaveLength(2)
    expect(tree[0].children[0].title).toBe('子项1')
    expect(tree[0].children[1].title).toBe('子项2')
    expect(tree[1].title).toBe('顶级')
    expect(tree[1].children).toHaveLength(0)
  })

  it('getMenuTree 过滤隐藏的顶级菜单及其子菜单', async () => {
    const hidden = await createMenu({ title: '隐藏父', url: '/hp', sortOrder: 0, hidden: 1 })
    await createMenu({ title: '隐藏父的子', url: '/hc', parentId: hidden.id, sortOrder: 0 })
    await createMenu({ title: '可见菜单', url: '/v', sortOrder: 1 })

    const tree = await getMenuTree()

    expect(tree).toHaveLength(1)
    expect(tree[0].title).toBe('可见菜单')
  })

  it('getMenuTree 过滤隐藏的子菜单', async () => {
    const parent = await createMenu({ title: '父', url: '/p', sortOrder: 0 })
    await createMenu({ title: '可见子', url: '/vc', parentId: parent.id, sortOrder: 0 })
    await createMenu({
      title: '隐藏子',
      url: '/hc',
      parentId: parent.id,
      sortOrder: 1,
      hidden: 1,
    })

    const tree = await getMenuTree()

    expect(tree).toHaveLength(1)
    expect(tree[0].children).toHaveLength(1)
    expect(tree[0].children[0].title).toBe('可见子')
  })

  it('listMenus 包含隐藏菜单（管理后台用）', async () => {
    await createMenu({ title: '可见', url: '/v' })
    await createMenu({ title: '隐藏', url: '/h', hidden: 1 })

    const list = await listMenus()
    expect(list).toHaveLength(2)
  })

  // ─── 恢复默认 ───

  it('resetMenus 恢复默认菜单', async () => {
    await createMenu({ title: '自定义', url: '/custom' })
    await createMenu({ title: '另一个', url: '/another' })

    await resetMenus()

    const list = await listMenus()
    expect(list).toHaveLength(4)
    expect(list.map((m) => m.title)).toEqual(['首页', '文章', '留言', '关于'])
  })

  it('resetMenus 清空已有菜单再插入', async () => {
    // 先重置一次
    await resetMenus()
    // 再重置一次不应报错
    await resetMenus()

    const list = await listMenus()
    expect(list).toHaveLength(4)
  })
})
