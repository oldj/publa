/**
 * 数据库初始数据脚本
 * 用于系统首次初始化时填充默认数据
 */
import { getMessage } from '@/i18n/core'
import enFrontend from '@/messages/en/frontend.json'
import {
  getDefaultSettingsPayload,
  serializeSettingValue,
  type PartialSettingType,
} from '@/server/services/settings'
import { eq } from 'drizzle-orm'
import type { BaseSQLiteDatabase } from 'drizzle-orm/sqlite-core'
import { db, dbReady } from './index'
import { contents, menus, settings, themes } from './schema'
import { isoNow } from './schema/shared'

type Messages = Record<string, unknown>

/** 按 locale 动态加载 frontend 翻译，找不到时回退英文 */
async function loadFrontendMessages(language: string): Promise<Messages> {
  if (language === 'en') return enFrontend
  try {
    return (await import(`../../messages/${language}/frontend.json`)).default
  } catch {
    return enFrontend
  }
}

/** 从已加载的 messages 取翻译，找不到时回退英文 */
function seedMsg(messages: Messages, path: string): string {
  const msg = getMessage(messages, path)
  if (typeof msg === 'string') return msg
  return getMessage(enFrontend, path) as string
}

function buildSeedSettings(language?: string) {
  const payload: PartialSettingType = getDefaultSettingsPayload()
  // activeThemeId 依赖内置主题真实 id，统一交给 ensureBuiltinThemes 动态写入。
  delete payload.activeThemeId

  if (language) {
    payload.language = language
  }

  return Object.entries(payload).map(([key, value]) => ({
    key,
    value: serializeSettingValue(key, value),
  }))
}

/** 内置主题。三项均不可编辑、不可删除，仅可参与排序和被选中 */
const BUILTIN_THEMES = [
  { name: 'Light', builtinKey: 'light', sortOrder: 1 },
  { name: 'Dark', builtinKey: 'dark', sortOrder: 2 },
  { name: 'Blank', builtinKey: 'blank', sortOrder: 3 },
] as const

function buildDefaultMenus(msg: Messages) {
  const m = (key: string) => seedMsg(msg, `nav.defaultMenus.${key}`)
  return [
    { title: m('home'), url: '/', sortOrder: 0, target: '_self' as const },
    { title: m('posts'), url: '/posts', sortOrder: 1, target: '_self' as const },
    { title: m('guestbook'), url: '/guestbook', sortOrder: 2, target: '_self' as const },
    { title: m('about'), url: '/about', sortOrder: 3, target: '_self' as const },
  ]
}

function buildDefaultAboutPage(msg: Messages) {
  const m = (key: string) => seedMsg(msg, `seed.aboutPage.${key}`)
  return {
    type: 'page' as const,
    title: m('title'),
    path: 'about',
    contentType: 'markdown' as const,
    contentRaw: m('contentRaw'),
    contentHtml: m('contentHtml'),
    template: 'default' as const,
    status: 'published' as const,
    publishedAt: new Date().toISOString(),
  }
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

export async function seed(tx?: BaseSQLiteDatabase<any, any, any>, options: SeedOptions = {}) {
  // 未传入事务时，CLI 脚本和非 Next.js 入口需要等待数据库初始化完成
  if (!tx) {
    await dbReady
  }

  const conn = tx ?? db

  const language = options.language ?? 'zh'
  const effectiveSettings = buildSeedSettings(language)
  const frontendMsg = await loadFrontendMessages(language)

  // 插入默认设置（跳过已存在的）
  for (const item of effectiveSettings) {
    await conn.insert(settings).values(item).onConflictDoNothing()
  }

  // 检查是否已有菜单
  const existingMenus = await conn.select().from(menus)
  if (existingMenus.length === 0) {
    await conn.insert(menus).values(buildDefaultMenus(frontendMsg))
  }

  // 检查是否已有关于页面
  const existingPages = await conn.select().from(contents)
  if (existingPages.length === 0) {
    await conn.insert(contents).values([buildDefaultAboutPage(frontendMsg), defaultRobotsTxt])
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
  const lightTheme = await conn.select().from(themes).where(eq(themes.builtinKey, 'light')).limit(1)
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
