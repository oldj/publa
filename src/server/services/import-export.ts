import { hashPassword } from '@/server/auth'
import { db } from '@/server/db'
import { maybeFirst } from '@/server/db/query'
import {
  attachments,
  categories,
  comments,
  contentRevisions,
  contents,
  contentTags,
  customStyles,
  guestbookMessages,
  menus,
  redirectRules,
  settings,
  slugHistories,
  tags,
  themes,
  users,
} from '@/server/db/schema'
import { ensureBuiltinThemes } from '@/server/db/seed'
import { isoNow } from '@/server/db/schema/shared'
import { syncPrimaryKeySequences } from '@/server/db/sequences'
import { htmlToText } from '@/server/lib/markdown'
import { recountCategoriesAndTags } from '@/server/services/post-count'
import { validateRedirectRuleInput } from '@/server/services/redirect-rules'
import {
  deserializeSettingValue,
  isKnownSettingKey,
  normalizeSettingsPayload,
  serializeSettingValue,
} from '@/server/services/settings'
import ver from '@/version.json'
import crypto from 'crypto'
import { asc, eq } from 'drizzle-orm'

const META_VERSION = '2.0'
const PUBLA_VERSION = ver.join('.')

// 敏感字段黑名单，导出时排除，导入时忽略并保留已有值
const SECRET_KEYS = new Set([
  'jwtSecret',
  'storageS3AccessKey',
  'storageS3SecretKey',
  'storageOssAccessKeyId',
  'storageOssAccessKeySecret',
  'storageCosSecretId',
  'storageCosSecretKey',
  'storageR2AccessKey',
  'storageR2SecretKey',
])

/** 导出内容数据（全量导出，包含软删除记录） */
export async function exportContentData() {
  // postCount 是派生字段，不参与导出；显式列选择保持与旧版本导出格式兼容
  const categoryRows = await db
    .select({
      id: categories.id,
      name: categories.name,
      slug: categories.slug,
      description: categories.description,
      sortOrder: categories.sortOrder,
      seoTitle: categories.seoTitle,
      seoDescription: categories.seoDescription,
    })
    .from(categories)

  const tagRows = await db
    .select({
      id: tags.id,
      name: tags.name,
      slug: tags.slug,
      seoTitle: tags.seoTitle,
      seoDescription: tags.seoDescription,
    })
    .from(tags)

  return {
    meta: {
      type: 'content',
      version: META_VERSION,
      publaVersion: PUBLA_VERSION,
      exportedAt: new Date().toISOString(),
    },
    categories: categoryRows,
    tags: tagRows,
    contents: await db.select().from(contents),
    contentTags: await db.select().from(contentTags),
    contentRevisions: await db.select().from(contentRevisions),
    slugHistories: await db.select().from(slugHistories),
    comments: await db.select().from(comments),
    guestbookMessages: await db.select().from(guestbookMessages),
    attachments: await db.select().from(attachments),
  }
}

/** 导出设置数据 */
export async function exportSettingsData() {
  // 用户数据不导出 passwordHash
  const userRows = await db
    .select({
      id: users.id,
      username: users.username,
      email: users.email,
      role: users.role,
      avatarUrl: users.avatarUrl,
      createdAt: users.createdAt,
      updatedAt: users.updatedAt,
    })
    .from(users)

  // 设置数据中排除存储敏感信息
  const allSettings = await db.select().from(settings)
  const filteredSettings = allSettings
    .filter((s) => isKnownSettingKey(s.key) && !SECRET_KEYS.has(s.key))
    .map((item) => ({
      key: item.key,
      value: deserializeSettingValue(item.key, item.value),
    }))

  return {
    meta: {
      type: 'settings',
      version: META_VERSION,
      publaVersion: PUBLA_VERSION,
      exportedAt: new Date().toISOString(),
    },
    users: userRows,
    settings: filteredSettings,
    menus: await db.select().from(menus),
    redirectRules: await db
      .select()
      .from(redirectRules)
      .orderBy(asc(redirectRules.sortOrder), asc(redirectRules.id)),
    // 主题与自定义 CSS 是持久化数据，随设置一起导出；保留原 id 以便 activeThemeId / activeCustomStyleIds 直接引用
    themes: await db.select().from(themes).orderBy(asc(themes.sortOrder), asc(themes.id)),
    customStyles: await db
      .select()
      .from(customStyles)
      .orderBy(asc(customStyles.sortOrder), asc(customStyles.id)),
  }
}

/** 校验导入数据基础格式 */
export function validateImportData(data: any): { valid: boolean; type?: string; message?: string } {
  if (!data?.meta?.type || !data?.meta?.version) {
    return { valid: false, message: '缺少 meta 信息' }
  }
  if (data.meta.version !== META_VERSION) {
    return { valid: false, message: `不支持的版本: ${data.meta.version}` }
  }

  if (data.meta.type === 'content') {
    for (const key of ['categories', 'tags', 'contents']) {
      if (!Array.isArray(data[key])) {
        return { valid: false, message: `缺少必要字段: ${key}` }
      }
    }
    return { valid: true, type: 'content' }
  }

  if (data.meta.type === 'settings') {
    for (const key of ['settings']) {
      if (!Array.isArray(data[key])) {
        return { valid: false, message: `缺少必要字段: ${key}` }
      }
    }
    // themes / customStyles 是后补的字段，兼容旧导出文件允许缺失，但出现时必须是数组
    for (const key of ['themes', 'customStyles']) {
      if (data[key] !== undefined && !Array.isArray(data[key])) {
        return { valid: false, message: `字段格式错误: ${key}` }
      }
    }
    return { valid: true, type: 'settings' }
  }

  return { valid: false, message: `未知的数据类型: ${data.meta.type}` }
}

/** 解析内容纯文本：优先使用已有值，其次从 HTML 或 Raw 推导 */
function resolveContentText(item: any): string {
  if (typeof item.contentText === 'string' && item.contentText !== '') {
    return item.contentText
  }

  if (typeof item.contentHtml === 'string' && item.contentHtml !== '') {
    return htmlToText(item.contentHtml)
  }

  if (typeof item.contentRaw === 'string' && item.contentRaw !== '') {
    return item.contentRaw
  }

  return ''
}

/** 查询当前有效的用户 ID 集合 */
async function getValidUserIds() {
  const userRows = await db.select({ id: users.id }).from(users)
  return new Set(userRows.map((item) => item.id))
}

/** 校验可空的用户引用字段，无效时置 null */
function nullifyInvalidUserRef(value: any, validUserIds: Set<number>): number | null {
  return validUserIds.has(value) ? value : null
}

/** 规范化导入的内容数据（文章+页面） */
function normalizeImportedContents(items: any[], validUserIds: Set<number>, currentUserId: number) {
  return items.map((item) => ({
    ...item,
    authorId: validUserIds.has(item.authorId) ? item.authorId : currentUserId,
    contentText: resolveContentText(item),
  }))
}

/** 规范化导入的历史记录 */
function normalizeImportedRevisions(
  items: any[],
  validUserIds: Set<number>,
  currentUserId: number,
) {
  return items.map((item) => ({
    ...item,
    createdBy: validUserIds.has(item.createdBy) ? item.createdBy : currentUserId,
  }))
}

/** 规范化导入的附件，清洗无效用户引用 */
function normalizeImportedAttachments(items: any[], validUserIds: Set<number>) {
  return items.map((item) => ({
    ...item,
    uploadedBy: nullifyInvalidUserRef(item.uploadedBy, validUserIds),
  }))
}

/** 规范化导入的评论，清洗无效用户引用 */
function normalizeImportedComments(items: any[], validUserIds: Set<number>) {
  return topologicalSort(items).map((item) => ({
    ...item,
    userId: nullifyInvalidUserRef(item.userId, validUserIds),
    moderatedBy: nullifyInvalidUserRef(item.moderatedBy, validUserIds),
  }))
}

function compareImportItemId(a: any, b: any): number {
  const aId = Number.isInteger(a?.id) ? a.id : Number.MAX_SAFE_INTEGER
  const bId = Number.isInteger(b?.id) ? b.id : Number.MAX_SAFE_INTEGER
  return aId - bId
}

/** 拓扑排序自引用记录，确保父记录先于子记录导入 */
function topologicalSort(items: any[], parentField = 'parentId') {
  const pending = [...items].sort(compareImportItemId)
  const insertedIds = new Set<number>()
  const normalized: any[] = []

  while (pending.length > 0) {
    let progressed = false

    for (let i = 0; i < pending.length; ) {
      const item = pending[i]
      if (item[parentField] == null || insertedIds.has(item[parentField])) {
        normalized.push(item)
        if (Number.isInteger(item.id)) insertedIds.add(item.id)
        pending.splice(i, 1)
        progressed = true
        continue
      }
      i += 1
    }

    if (!progressed) {
      normalized.push(...pending.sort(compareImportItemId))
      break
    }
  }

  return normalized
}

/** 导入内容数据（覆盖模式） */
export async function importContentData(data: any, currentUserId: number) {
  const validUserIds = await getValidUserIds()

  const normalizedContents =
    Array.isArray(data.contents) && data.contents.length > 0
      ? normalizeImportedContents(data.contents, validUserIds, currentUserId)
      : []

  const normalizedComments = Array.isArray(data.comments)
    ? normalizeImportedComments(data.comments, validUserIds)
    : []

  const normalizedRevisions =
    Array.isArray(data.contentRevisions) && data.contentRevisions.length > 0
      ? normalizeImportedRevisions(data.contentRevisions, validUserIds, currentUserId)
      : []

  const normalizedAttachments = Array.isArray(data.attachments)
    ? normalizeImportedAttachments(data.attachments, validUserIds)
    : []

  const results: string[] = []

  await db.transaction(async (tx) => {
    // 按外键依赖顺序删除
    await tx.delete(contentTags)
    await tx.delete(comments)
    await tx.delete(contentRevisions)
    await tx.delete(slugHistories)
    await tx.delete(contents)
    await tx.delete(categories)
    await tx.delete(tags)
    await tx.delete(guestbookMessages)
    await tx.delete(attachments)

    if (Array.isArray(data.categories) && data.categories.length > 0) {
      for (const item of data.categories) {
        // postCount 是派生字段，导入时忽略，由事务末尾的重算回填
        const { postCount: _postCount, ...rest } = item ?? {}
        await tx.insert(categories).values(rest)
      }
      results.push(`分类: ${data.categories.length} 条`)
    }

    if (Array.isArray(data.tags) && data.tags.length > 0) {
      for (const item of data.tags) {
        const { postCount: _postCount, ...rest } = item ?? {}
        await tx.insert(tags).values(rest)
      }
      results.push(`标签: ${data.tags.length} 条`)
    }

    if (normalizedAttachments.length > 0) {
      for (const item of normalizedAttachments) {
        await tx.insert(attachments).values(item)
      }
      results.push(`附件: ${normalizedAttachments.length} 条`)
    }

    if (normalizedContents.length > 0) {
      for (const item of normalizedContents) {
        await tx.insert(contents).values(item)
      }
      results.push(`内容: ${data.contents.length} 条`)
    }

    if (Array.isArray(data.contentTags) && data.contentTags.length > 0) {
      for (const item of data.contentTags) {
        await tx.insert(contentTags).values(item)
      }
      results.push(`内容标签: ${data.contentTags.length} 条`)
    }

    if (Array.isArray(data.slugHistories) && data.slugHistories.length > 0) {
      for (const item of data.slugHistories) {
        await tx.insert(slugHistories).values(item)
      }
      results.push(`Slug 历史: ${data.slugHistories.length} 条`)
    }

    if (normalizedRevisions.length > 0) {
      for (const item of normalizedRevisions) {
        await tx.insert(contentRevisions).values(item)
      }
      results.push(`历史记录: ${normalizedRevisions.length} 条`)
    }

    if (normalizedComments.length > 0) {
      for (const item of normalizedComments) {
        await tx.insert(comments).values(item)
      }
      results.push(`评论: ${normalizedComments.length} 条`)
    }

    if (Array.isArray(data.guestbookMessages) && data.guestbookMessages.length > 0) {
      for (const item of data.guestbookMessages) {
        await tx.insert(guestbookMessages).values(item)
      }
      results.push(`留言: ${data.guestbookMessages.length} 条`)
    }

    await syncPrimaryKeySequences(tx)

    // 导入完成后重算分类/标签的 postCount（导入内容未知，无条件触发）
    await recountCategoriesAndTags(tx)
  })

  return results
}

/** 导入设置数据（覆盖模式） */
export async function importSettingsData(data: any, currentUserId: number) {
  const results: string[] = []

  // 先在事务外读取需要保留的敏感设置
  let existingSecrets: Record<string, string> = {}
  if (Array.isArray(data.settings)) {
    const existing = await db.select().from(settings)
    for (const s of existing) {
      if (SECRET_KEYS.has(s.key)) existingSecrets[s.key] = s.value
    }
  }

  const normalizedRedirectRules = Array.isArray(data.redirectRules)
    ? [...data.redirectRules]
        .sort((a, b) => {
          const aOrder = Number.isInteger(a?.sortOrder) ? a.sortOrder : 0
          const bOrder = Number.isInteger(b?.sortOrder) ? b.sortOrder : 0
          return aOrder - bOrder
        })
        .map((item) => ({
          id: Number.isInteger(item?.id) && item.id > 0 ? item.id : undefined,
          ...validateRedirectRuleInput({
            pathRegex: item?.pathRegex,
            redirectTo: item?.redirectTo,
            redirectType: item?.redirectType,
            memo: item?.memo,
          }),
        }))
    : null

  // 菜单拓扑排序处理 parentId 自引用
  const normalizedMenus = Array.isArray(data.menus) ? topologicalSort(data.menus) : null

  await db.transaction(async (tx) => {
    // 主题与自定义 CSS 先于 settings 写入：activeThemeId / activeCustomStyleIds 指向的
    // id 必须在 settings 落库前就存在，否则前台读到空数据。
    if (Array.isArray(data.themes)) {
      await tx.delete(themes)
      for (const item of data.themes) {
        await tx.insert(themes).values({
          id: item.id,
          name: item.name,
          css: item.css ?? '',
          sortOrder: Number.isInteger(item.sortOrder) ? item.sortOrder : 0,
          builtinKey: item.builtinKey ?? null,
          createdAt: item.createdAt ?? isoNow(),
          updatedAt: item.updatedAt ?? isoNow(),
        })
      }
      results.push(`主题: ${data.themes.length} 条`)
    }

    if (Array.isArray(data.customStyles)) {
      await tx.delete(customStyles)
      for (const item of data.customStyles) {
        await tx.insert(customStyles).values({
          id: item.id,
          name: item.name,
          css: item.css ?? '',
          sortOrder: Number.isInteger(item.sortOrder) ? item.sortOrder : 0,
          createdAt: item.createdAt ?? isoNow(),
          updatedAt: item.updatedAt ?? isoNow(),
        })
      }
      results.push(`自定义 CSS: ${data.customStyles.length} 条`)
    }

    // 若导入数据缺失内置主题（旧版本导出或空库恢复），补齐三项内置主题保证前台可用
    await ensureBuiltinThemes(tx as any)

    if (Array.isArray(data.settings)) {
      const inputSettings: Record<string, unknown> = {}
      for (const item of data.settings) {
        if (
          item?.key &&
          typeof item.key === 'string' &&
          item.value !== undefined &&
          !SECRET_KEYS.has(item.key) &&
          isKnownSettingKey(item.key)
        ) {
          inputSettings[item.key] = item.value
        }
      }
      const normalizedSettings = normalizeSettingsPayload(inputSettings)

      await tx.delete(settings)

      // 导入非敏感设置
      for (const [key, value] of Object.entries(normalizedSettings)) {
        await tx.insert(settings).values({ key, value: serializeSettingValue(key, value) })
      }

      // 恢复敏感设置
      for (const [key, value] of Object.entries(existingSecrets)) {
        await tx.insert(settings).values({ key, value })
      }

      results.push(`设置: ${Object.keys(normalizedSettings).length} 条`)
    }

    // 清空并重新导入菜单
    if (normalizedMenus) {
      await tx.delete(menus)
      for (const item of normalizedMenus) {
        await tx.insert(menus).values(item)
      }
      results.push(`菜单: ${data.menus.length} 条`)
    }

    if (normalizedRedirectRules) {
      await tx.delete(redirectRules)

      for (const [index, item] of normalizedRedirectRules.entries()) {
        await tx.insert(redirectRules).values({
          id: item.id,
          sortOrder: index + 1,
          pathRegex: item.pathRegex,
          redirectTo: item.redirectTo,
          redirectType: item.redirectType,
          memo: item.memo ?? null,
        })
      }

      results.push(`跳转规则: ${normalizedRedirectRules.length} 条`)
    }

    await syncPrimaryKeySequences(tx)
  })

  // 用户导入在事务外执行（包含 hashPassword 等耗时操作，且是 upsert 不存在先删后插风险）
  if (Array.isArray(data.users) && data.users.length > 0) {
    let created = 0,
      updated = 0
    for (const item of data.users) {
      if (!item.username) continue
      const existing = await maybeFirst(
        db.select().from(users).where(eq(users.username, item.username)).limit(1),
      )
      if (existing) {
        // 更新除密码外的字段；当前操作用户不修改角色，防止自己失去权限
        const updateFields: Record<string, any> = {
          email: item.email ?? existing.email,
          avatarUrl: item.avatarUrl ?? existing.avatarUrl,
          updatedAt: new Date().toISOString(),
        }
        if (existing.id !== currentUserId) {
          updateFields.role = item.role ?? existing.role
        }
        await db.update(users).set(updateFields).where(eq(users.id, existing.id))
        updated++
      } else {
        // 新建用户，生成随机密码
        const randomPassword = crypto.randomBytes(16).toString('base64url')
        const passwordHash = await hashPassword(randomPassword)
        await db.insert(users).values({
          username: item.username,
          email: item.email || null,
          passwordHash,
          role: item.role || 'editor',
          avatarUrl: item.avatarUrl || null,
        })
        created++
      }
    }
    results.push(`用户: 新建 ${created} 个, 更新 ${updated} 个`)
  }

  return results
}
