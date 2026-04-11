/**
 * 数据库初始数据脚本
 * 用于系统首次初始化时填充默认数据
 */
import { serializeSettingValue } from '@/server/services/settings'
import type { BaseSQLiteDatabase } from 'drizzle-orm/sqlite-core'
import { eq } from 'drizzle-orm'
import { db, dbReady } from './index'
import { contents, menus, settings, themes } from './schema'
import { isoNow } from './schema/shared'

/** 默认系统设置（原生类型，插入时自动 JSON 序列化） */
const defaultSettings = (
  [
    { key: 'siteTitle', value: 'Publa' },
    { key: 'siteSlogan', value: 'Yet Another Amazing Blog' },
    { key: 'siteDescription', value: '' },
    { key: 'siteUrl', value: '' },
    { key: 'language', value: 'zh' },
    { key: 'timezone', value: 'Asia/Shanghai' },
    { key: 'faviconUrl', value: '' },
    { key: 'faviconMode', value: 'default' },
    { key: 'faviconData', value: '' },
    { key: 'faviconMimeType', value: '' },
    { key: 'faviconVersion', value: '' },
    { key: 'defaultTheme', value: 'light' },
    { key: 'enableComment', value: true },
    { key: 'showCommentsGlobally', value: true },
    { key: 'defaultApprove', value: false },
    { key: 'enableRss', value: true },
    { key: 'rssTitle', value: '' },
    { key: 'rssDescription', value: '' },
    { key: 'rssContent', value: 'full' },
    { key: 'rssLimit', value: 20 },
    { key: 'enableGuestbook', value: true },
    { key: 'enableSearch', value: true },
    { key: 'guestbookWelcome', value: '欢迎给我留言！' },
    // 底部版权
    { key: 'footerCopyright', value: '{SITE_NAME} &copy; {FULL_YEAR}' },
    // 自定义 HTML
    { key: 'customAfterPostHtml', value: '' },
    { key: 'customHeadHtml', value: '' },
    { key: 'customBodyStartHtml', value: '' },
    { key: 'customBodyEndHtml', value: '' },
    // 主题与自定义 CSS 选中状态。activeThemeId 在内置主题插入后写入
    { key: 'activeCustomStyleIds', value: [] },
  ] as { key: string; value: unknown }[]
).map(({ key, value }) => ({ key, value: serializeSettingValue(key, value) }))

/** 内置主题。三项均不可编辑、不可删除，仅可参与排序和被选中 */
const BUILTIN_THEMES = [
  { name: '浅色', builtinKey: 'light', sortOrder: 1 },
  { name: '深色', builtinKey: 'dark', sortOrder: 2 },
  { name: '空白', builtinKey: 'blank', sortOrder: 3 },
] as const

/** 默认菜单项 */
const defaultMenus = [
  { title: '首页', url: '/', sortOrder: 0, target: '_self' as const },
  { title: '文章', url: '/posts', sortOrder: 1, target: '_self' as const },
  { title: '留言', url: '/guestbook', sortOrder: 2, target: '_self' as const },
  { title: '关于', url: '/about', sortOrder: 3, target: '_self' as const },
]

/** 默认关于页面 */
const defaultAboutPage = {
  type: 'page' as const,
  title: '关于',
  path: 'about',
  contentType: 'markdown' as const,
  contentRaw: '# 关于\n\n欢迎来到我的博客！',
  contentHtml: '<h1>关于</h1>\n<p>欢迎来到我的博客！</p>',
  template: 'default' as const,
  status: 'published' as const,
  publishedAt: new Date().toISOString(),
}

/** 默认 robots.txt 页面 */
const defaultRobotsTxt = {
  type: 'page' as const,
  title: 'robots.txt',
  path: 'robots.txt',
  contentType: 'html' as const,
  contentRaw: 'User-agent: *\nDisallow:',
  contentHtml: 'User-agent: *\nDisallow:',
  template: 'blank' as const,
  mimeType: 'text/plain',
  status: 'published' as const,
  publishedAt: new Date().toISOString(),
}

export interface SeedOptions {
  /** 初始化时选定的界面语言，会覆盖默认的 'zh' */
  language?: string
}

export async function seed(
  tx?: BaseSQLiteDatabase<any, any, any>,
  options: SeedOptions = {},
) {
  // 未传入事务时，CLI 脚本和非 Next.js 入口需要等待数据库初始化完成
  if (!tx) {
    await dbReady
  }

  const conn = tx ?? db

  // 按传入的 language 覆盖默认值（onConflictDoNothing 保证已有值不被覆盖）
  const effectiveSettings = options.language
    ? defaultSettings.map((item) =>
        item.key === 'language'
          ? { key: item.key, value: serializeSettingValue(item.key, options.language) }
          : item,
      )
    : defaultSettings

  // 插入默认设置（跳过已存在的）
  for (const item of effectiveSettings) {
    await conn.insert(settings).values(item).onConflictDoNothing()
  }

  // 检查是否已有菜单
  const existingMenus = await conn.select().from(menus)
  if (existingMenus.length === 0) {
    await conn.insert(menus).values(defaultMenus)
  }

  // 检查是否已有关于页面
  const existingPages = await conn.select().from(contents)
  if (existingPages.length === 0) {
    await conn.insert(contents).values([defaultAboutPage, defaultRobotsTxt])
  }

  // 幂等写入内置主题与默认 activeThemeId
  await ensureBuiltinThemes(conn)

  console.log('Seed completed.')
}

/**
 * 幂等确保内置主题（浅色/深色/空白）存在，并设置默认选中主题。
 * 供 seed() 和应用启动（instrumentation）共同调用，支持已有数据库平滑升级。
 */
export async function ensureBuiltinThemes(
  conn: BaseSQLiteDatabase<any, any, any> | typeof db = db,
) {
  const now = isoNow()
  for (const item of BUILTIN_THEMES) {
    const existing = await conn
      .select()
      .from(themes)
      .where(eq(themes.builtinKey, item.builtinKey))
      .limit(1)
    if (existing.length === 0) {
      await conn.insert(themes).values({
        name: item.name,
        css: '',
        sortOrder: item.sortOrder,
        builtinKey: item.builtinKey,
        createdAt: now,
        updatedAt: now,
      })
    }
  }

  // 默认选中"浅色"主题（若尚未设置）
  const lightTheme = await conn
    .select()
    .from(themes)
    .where(eq(themes.builtinKey, 'light'))
    .limit(1)
  if (lightTheme.length > 0) {
    await conn
      .insert(settings)
      .values({
        key: 'activeThemeId',
        value: serializeSettingValue('activeThemeId', lightTheme[0].id),
      })
      .onConflictDoNothing()
  }
}

// 允许直接运行
if (require.main === module) {
  seed().catch(console.error)
}
