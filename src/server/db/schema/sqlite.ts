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
  attachments,
  captchas,
  categories,
  comments,
  contents,
  contentRevisions,
  contentTags,
  guestbookMessages,
  menus,
  rateEvents,
  redirectRules,
  settings,
  slugHistories,
  tags,
  users,
} = schema

export const sqliteSchema = schema
