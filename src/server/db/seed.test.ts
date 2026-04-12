import * as schema from '@/server/db/schema'
import { setupTestDb, testDb } from '@/server/services/__test__/setup'
import { eq } from 'drizzle-orm'
import { beforeEach, describe, expect, it } from 'vitest'

const { seed } = await import('./seed')

describe('seed', () => {
  beforeEach(async () => {
    await setupTestDb()
  })

  it('从统一默认设置来源填充初始设置，并保留动态主题默认值', async () => {
    await seed(undefined, { language: 'en' })

    const rows = await testDb.select().from(schema.settings)
    const map = Object.fromEntries(rows.map((item) => [item.key, item.value]))
    const [lightTheme] = await testDb
      .select({ id: schema.themes.id })
      .from(schema.themes)
      .where(eq(schema.themes.builtinKey, 'light'))
      .limit(1)

    expect(map.language).toBe('"en"')
    expect(map.siteSlogan).toBe('"Yet Another Amazing Blog"')
    expect(map.enableComment).toBe('true')
    expect(map.guestbookWelcome).toBe('""')
    expect(map.emailSmtpEncryption).toBe('"tls"')
    expect(map.emailNotifyNewComment).toBe('{"enabled":false,"userIds":[]}')
    expect(map.activeThemeId).toBe(String(lightTheme?.id))
  })

  it('英文初始化时菜单和关于页面为英文', async () => {
    await seed(undefined, { language: 'en' })

    const menuRows = await testDb.select().from(schema.menus)
    const titles = menuRows.sort((a, b) => a.sortOrder - b.sortOrder).map((m) => m.title)
    expect(titles).toEqual(['Home', 'Posts', 'Guestbook', 'About'])

    const aboutPage = await testDb
      .select()
      .from(schema.contents)
      .where(eq(schema.contents.path, 'about'))
      .limit(1)
    expect(aboutPage[0]?.title).toBe('About')
  })

  it('中文初始化时菜单和关于页面为中文', async () => {
    await seed(undefined, { language: 'zh' })

    const menuRows = await testDb.select().from(schema.menus)
    const titles = menuRows.sort((a, b) => a.sortOrder - b.sortOrder).map((m) => m.title)
    expect(titles).toEqual(['首页', '文章', '留言', '关于'])

    const aboutPage = await testDb
      .select()
      .from(schema.contents)
      .where(eq(schema.contents.path, 'about'))
      .limit(1)
    expect(aboutPage[0]?.title).toBe('关于')
  })
})
