import { desc } from 'drizzle-orm'
import {
  activityAction,
  commentStatus,
  contentItemType,
  contentStatus,
  contentType,
  emailEventType,
  emailLogStatus,
  guestbookStatus,
  isoNow,
  menuTarget,
  pageTemplate,
  rateEventType,
  redirectType,
  revisionStatus,
  revisionTargetType,
  storageProvider,
  userRole,
} from './shared'

type SqliteCore = typeof import('drizzle-orm/sqlite-core')

/**
 * 方言相关的列/表构建器，由 sqlite.ts 和 postgres.ts 分别传入。
 * 以 SQLite 类型为基准声明接口，保证返回的表对象有正确的 drizzle 类型。
 * postgres.ts 通过 as any 传入 PG 构建器，运行时行为正确，类型统一为 SQLite。
 */
export interface DialectKit {
  table: SqliteCore['sqliteTable']
  text: SqliteCore['text']
  integer: SqliteCore['integer']
  index: SqliteCore['index']
  primaryKey: SqliteCore['primaryKey']
  /** 自增整数主键：PG 用 serial，SQLite 用 integer + autoIncrement */
  autoId: () => any
  /** 布尔列：PG 用 boolean，SQLite 用 integer({ mode: 'boolean' }) */
  bool: (name: string) => any
}

export function defineSchema(kit: DialectKit) {
  const { table, text, integer, index, primaryKey, autoId, bool } = kit

  const users = table('users', {
    id: autoId(),
    username: text('username').notNull().unique(),
    email: text('email'),
    passwordHash: text('password_hash').notNull(),
    role: text('role', { enum: userRole }).notNull().default('editor'),
    avatarUrl: text('avatar_url'),
    createdAt: text('created_at').notNull().$defaultFn(isoNow),
    updatedAt: text('updated_at').notNull().$defaultFn(isoNow),
  })

  const activityLogs = table(
    'activity_logs',
    {
      id: autoId(),
      userId: integer('user_id')
        .notNull()
        .references(() => users.id),
      action: text('action', { enum: activityAction }).notNull(),
      ipAddress: text('ip_address'),
      userAgent: text('user_agent'),
      createdAt: text('created_at').notNull().$defaultFn(isoNow),
    },
    (t: any) => [
      index('activity_logs_user_created_idx').on(t.userId, desc(t.createdAt)),
      index('activity_logs_created_idx').on(desc(t.createdAt)),
    ],
  )

  const attachments = table(
    'attachments',
    {
      id: autoId(),
      filename: text('filename').notNull(),
      originalFilename: text('original_filename').notNull(),
      mimeType: text('mime_type').notNull(),
      size: integer('size').notNull(),
      width: integer('width'),
      height: integer('height'),
      storageProvider: text('storage_provider', { enum: storageProvider }).notNull(),
      storageKey: text('storage_key').notNull(),
      uploadedBy: integer('uploaded_by').references(() => users.id),
      createdAt: text('created_at').notNull().$defaultFn(isoNow),
      deletedAt: text('deleted_at'),
    },
    (t: any) => [index('attachments_storage_key_idx').on(t.storageKey)],
  )

  const categories = table('categories', {
    id: autoId(),
    name: text('name').notNull(),
    slug: text('slug').notNull().unique(),
    description: text('description'),
    sortOrder: integer('sort_order').notNull().default(0),
    seoTitle: text('seo_title'),
    seoDescription: text('seo_description'),
    postCount: integer('post_count').notNull().default(0),
  })

  const tags = table('tags', {
    id: autoId(),
    name: text('name').notNull(),
    slug: text('slug').notNull().unique(),
    seoTitle: text('seo_title'),
    seoDescription: text('seo_description'),
    postCount: integer('post_count').notNull().default(0),
  })

  const captchas = table('captchas', {
    id: autoId(),
    sessionId: text('session_id').notNull().unique(),
    text: text('text').notNull(),
    expiresAt: text('expires_at').notNull(),
  })

  const settings = table('settings', {
    key: text('key').primaryKey(),
    value: text('value').notNull().default(''),
  })

  const guestbookMessages = table('guestbook_messages', {
    id: autoId(),
    authorName: text('author_name').notNull(),
    authorEmail: text('author_email'),
    authorWebsite: text('author_website'),
    content: text('content').notNull(),
    ipAddress: text('ip_address'),
    userAgent: text('user_agent'),
    status: text('status', { enum: guestbookStatus }).notNull().default('unread'),
    createdAt: text('created_at').notNull().$defaultFn(isoNow),
    deletedAt: text('deleted_at'),
  })

  const menus = table('menus', {
    id: autoId(),
    title: text('title').notNull(),
    url: text('url').notNull(),
    parentId: integer('parent_id').references((): any => menus.id),
    sortOrder: integer('sort_order').notNull().default(0),
    target: text('target', { enum: menuTarget }).notNull().default('_self'),
    hidden: integer('hidden').notNull().default(0),
    createdAt: text('created_at').notNull().$defaultFn(isoNow),
  })

  const contents = table(
    'contents',
    {
      id: autoId(),
      type: text('type', { enum: contentItemType }).notNull(),
      title: text('title').notNull(),
      // post 专用
      slug: text('slug').unique(),
      authorId: integer('author_id').references(() => users.id),
      contentText: text('content_text').notNull().default(''),
      excerpt: text('excerpt'),
      excerptAuto: text('excerpt_auto'),
      categoryId: integer('category_id').references(() => categories.id),
      coverImage: text('cover_image'),
      allowComment: bool('allow_comment').notNull().default(true),
      showComments: bool('show_comments').notNull().default(true),
      viewCount: integer('view_count').notNull().default(0),
      pinned: bool('pinned').notNull().default(false),
      // page 专用
      path: text('path').unique(),
      template: text('template', { enum: pageTemplate }),
      mimeType: text('mime_type'),
      // 共有
      contentType: text('content_type', { enum: contentType }).notNull().default('richtext'),
      contentRaw: text('content_raw').notNull().default(''),
      contentHtml: text('content_html').notNull().default(''),
      status: text('status', { enum: contentStatus }).notNull().default('draft'),
      seoTitle: text('seo_title'),
      seoDescription: text('seo_description'),
      canonicalUrl: text('canonical_url'),
      createdAt: text('created_at').notNull().$defaultFn(isoNow),
      updatedAt: text('updated_at').notNull().$defaultFn(isoNow),
      publishedAt: text('published_at'),
      deletedAt: text('deleted_at'),
    },
    (t: any) => [
      index('contents_type_deleted_pinned_published_created_idx').on(
        t.type,
        t.deletedAt,
        desc(t.pinned),
        desc(t.publishedAt),
        desc(t.createdAt),
      ),
      index('contents_type_status_deleted_published_idx').on(
        t.type,
        t.status,
        t.deletedAt,
        desc(t.publishedAt),
      ),
      index('contents_type_status_deleted_pinned_published_idx').on(
        t.type,
        t.status,
        t.deletedAt,
        desc(t.pinned),
        desc(t.publishedAt),
      ),
      index('contents_categoryid_idx').on(t.categoryId),
    ],
  )

  const contentRevisions = table(
    'content_revisions',
    {
      id: autoId(),
      targetType: text('target_type', { enum: revisionTargetType }).notNull(),
      targetId: integer('target_id').notNull(),
      title: text('title').notNull().default(''),
      excerpt: text('excerpt').notNull().default(''),
      contentType: text('content_type', { enum: contentType }).notNull().default('richtext'),
      contentRaw: text('content_raw').notNull().default(''),
      contentHtml: text('content_html').notNull().default(''),
      contentText: text('content_text').notNull().default(''),
      metaJson: text('meta_json').notNull().default('{}'),
      status: text('status', { enum: revisionStatus }).notNull().default('draft'),
      createdAt: text('created_at').notNull().$defaultFn(isoNow),
      updatedAt: text('updated_at').notNull().$defaultFn(isoNow),
      createdBy: integer('created_by')
        .notNull()
        .references(() => users.id),
      updatedBy: integer('updated_by').references(() => users.id),
    },
    (t: any) => [
      index('content_revisions_target_status_updated_at_idx').on(
        t.targetType,
        t.targetId,
        t.status,
        desc(t.updatedAt),
      ),
    ],
  )

  const contentTags = table(
    'content_tags',
    {
      contentId: integer('content_id')
        .notNull()
        .references(() => contents.id),
      tagId: integer('tag_id')
        .notNull()
        .references(() => tags.id),
    },
    (t: any) => [
      primaryKey({ columns: [t.contentId, t.tagId] }),
      index('content_tags_tag_content_idx').on(t.tagId, t.contentId),
    ],
  )

  const slugHistories = table(
    'slug_histories',
    {
      id: autoId(),
      contentId: integer('content_id')
        .notNull()
        .references(() => contents.id),
      slug: text('slug').notNull(),
      createdAt: text('created_at').notNull().$defaultFn(isoNow),
    },
    (t: any) => [index('slug_histories_slug_idx').on(t.slug)],
  )

  const redirectRules = table(
    'redirect_rules',
    {
      id: autoId(),
      sortOrder: integer('sort_order').notNull().default(0),
      pathRegex: text('path_regex').notNull(),
      redirectTo: text('redirect_to').notNull(),
      redirectType: text('redirect_type', { enum: redirectType }).notNull().default('301'),
      memo: text('memo'),
    },
    (t: any) => [index('redirect_rules_sort_order_idx').on(t.sortOrder, t.id)],
  )

  const comments = table(
    'comments',
    {
      id: autoId(),
      contentId: integer('content_id')
        .notNull()
        .references(() => contents.id),
      parentId: integer('parent_id').references((): any => comments.id),
      userId: integer('user_id').references(() => users.id),
      authorName: text('author_name').notNull(),
      authorEmail: text('author_email'),
      authorWebsite: text('author_website'),
      content: text('content').notNull(),
      ipAddress: text('ip_address'),
      userAgent: text('user_agent'),
      status: text('status', { enum: commentStatus }).notNull().default('pending'),
      moderatedBy: integer('moderated_by').references(() => users.id),
      moderatedAt: text('moderated_at'),
      createdAt: text('created_at').notNull().$defaultFn(isoNow),
      deletedAt: text('deleted_at'),
    },
    (t: any) => [
      index('comments_content_status_deleted_created_idx').on(
        t.contentId,
        t.status,
        t.deletedAt,
        t.createdAt,
      ),
      index('comments_deleted_status_created_idx').on(t.deletedAt, t.status, desc(t.createdAt)),
      index('comments_author_email_deleted_status_idx').on(t.authorEmail, t.deletedAt, t.status),
    ],
  )

  const rateEvents = table(
    'rate_events',
    {
      id: autoId(),
      eventType: text('event_type', { enum: rateEventType }).notNull(),
      identifier: text('identifier').notNull(),
      ipAddress: text('ip_address'),
      createdAt: text('created_at').notNull().$defaultFn(isoNow),
    },
    (t: any) => [
      index('rate_events_type_identifier_created_idx').on(t.eventType, t.identifier, t.createdAt),
      index('rate_events_created_idx').on(t.createdAt),
    ],
  )

  const emailLogs = table(
    'email_logs',
    {
      id: autoId(),
      eventType: text('event_type', { enum: emailEventType }).notNull(),
      recipients: text('recipients').notNull(),
      subject: text('subject').notNull(),
      status: text('status', { enum: emailLogStatus }).notNull(),
      errorMessage: text('error_message'),
      createdAt: text('created_at').notNull().$defaultFn(isoNow),
    },
    (t: any) => [index('email_logs_created_idx').on(desc(t.createdAt))],
  )

  return {
    activityLogs,
    attachments,
    captchas,
    categories,
    comments,
    contents,
    contentRevisions,
    contentTags,
    emailLogs,
    guestbookMessages,
    menus,
    rateEvents,
    redirectRules,
    settings,
    slugHistories,
    tags,
    users,
  }
}
