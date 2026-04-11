import { getDatabaseFamily } from '@/server/db/family'
import { postgresSchema } from './postgres'
import { sqliteSchema } from './sqlite'

const runtimeSchema = getDatabaseFamily() === 'postgres' ? postgresSchema : sqliteSchema

export const schema = runtimeSchema

export const activityLogs = runtimeSchema.activityLogs as typeof sqliteSchema.activityLogs
export const attachments = runtimeSchema.attachments as typeof sqliteSchema.attachments
export const captchas = runtimeSchema.captchas as typeof sqliteSchema.captchas
export const emailLogs = runtimeSchema.emailLogs as typeof sqliteSchema.emailLogs
export const categories = runtimeSchema.categories as typeof sqliteSchema.categories
export const comments = runtimeSchema.comments as typeof sqliteSchema.comments
export const contents = runtimeSchema.contents as typeof sqliteSchema.contents
export const contentRevisions =
  runtimeSchema.contentRevisions as typeof sqliteSchema.contentRevisions
export const contentTags = runtimeSchema.contentTags as typeof sqliteSchema.contentTags
export const customStyles = runtimeSchema.customStyles as typeof sqliteSchema.customStyles
export const guestbookMessages =
  runtimeSchema.guestbookMessages as typeof sqliteSchema.guestbookMessages
export const menus = runtimeSchema.menus as typeof sqliteSchema.menus
export const rateEvents = runtimeSchema.rateEvents as typeof sqliteSchema.rateEvents
export const redirectRules = runtimeSchema.redirectRules as typeof sqliteSchema.redirectRules
export const settings = runtimeSchema.settings as typeof sqliteSchema.settings
export const slugHistories = runtimeSchema.slugHistories as typeof sqliteSchema.slugHistories
export const tags = runtimeSchema.tags as typeof sqliteSchema.tags
export const themes = runtimeSchema.themes as typeof sqliteSchema.themes
export const users = runtimeSchema.users as typeof sqliteSchema.users
