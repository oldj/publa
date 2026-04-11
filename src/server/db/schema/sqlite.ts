import { index, integer, primaryKey, sqliteTable, text } from 'drizzle-orm/sqlite-core'
import { defineSchema } from './define'

const schema = defineSchema({
  table: sqliteTable,
  text,
  integer,
  index,
  primaryKey,
  autoId: () => integer('id').primaryKey({ autoIncrement: true }),
  bool: (name: string) => integer(name, { mode: 'boolean' }),
})

export const {
  activityLogs,
  attachments,
  captchas,
  categories,
  comments,
  contents,
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

export const sqliteSchema = schema
