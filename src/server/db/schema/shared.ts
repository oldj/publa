export const contentStatus = ['draft', 'scheduled', 'published'] as const
export const contentItemType = ['post', 'page'] as const
export const commentStatus = ['pending', 'approved', 'rejected'] as const
export const guestbookStatus = ['unread', 'read'] as const
export const menuTarget = ['_self', '_blank'] as const
export const contentType = ['richtext', 'markdown', 'html'] as const
export const pageTemplate = ['default', 'blank'] as const
export const revisionStatus = ['draft', 'published', 'snapshot'] as const
export const revisionTargetType = ['post', 'page'] as const
export const storageProvider = ['s3', 'r2', 'oss', 'cos'] as const
export const rateEventType = [
  'login_fail',
  'login_lock_username',
  'login_lock_ip',
  'comment',
  'guestbook',
] as const
export const userRole = ['owner', 'admin', 'editor'] as const
export const redirectType = ['301', '302', '307', '308'] as const
export const emailLogStatus = ['success', 'fail'] as const
export const emailEventType = ['new_comment', 'new_guestbook', 'test'] as const

export const activityAction = [
  'login',
  'login_fail',
  'logout',
  'create_post',
  'update_post',
  'delete_post',
  'create_page',
  'update_page',
  'delete_page',
  'create_user',
  'update_user',
  'delete_user',
  'create_category',
  'update_category',
  'delete_category',
  'create_tag',
  'update_tag',
  'delete_tag',
  'create_menu',
  'update_menu',
  'delete_menu',
  'moderate_comment',
  'delete_comment',
  'moderate_guestbook',
  'delete_guestbook',
  'upload_attachment',
  'delete_attachment',
  'update_settings',
  'create_redirect',
  'update_redirect',
  'delete_redirect',
  'import_data',
  'export_data',
  'recount_categories',
  'recount_tags',
  'create_theme',
  'update_theme',
  'delete_theme',
  'create_custom_style',
  'update_custom_style',
  'delete_custom_style',
  'export_themes',
  'import_themes',
  'export_custom_styles',
  'import_custom_styles',
] as const

export function isoNow() {
  return new Date().toISOString()
}
