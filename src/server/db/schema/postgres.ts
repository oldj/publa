import { boolean, index, integer, pgTable, primaryKey, serial, text } from 'drizzle-orm/pg-core'
import { type DialectKit, defineSchema } from './define'

// PG 构建器在运行时与 SQLite 调用签名兼容，通过 as any 绕过类型差异
const schema = defineSchema({
  table: pgTable,
  text,
  integer,
  index,
  primaryKey,
  autoId: () => serial('id').primaryKey(),
  bool: (name: string) => boolean(name),
} as unknown as DialectKit)

export const {
  activityLogs,
  attachments,
  captchas,
  categories,
  comments,
  contents,
  contentDailyViews,
  contentRevisions,
  contentTags,
  customStyles,
  emailLogs,
  guestbookMessages,
  menus,
  rateEvents,
  redirectRules,
  settings,
  slugHistories,
  tags,
  themes,
  users,
} = schema

export const postgresSchema = schema
