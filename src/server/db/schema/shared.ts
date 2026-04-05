export const contentStatus = ['draft', 'scheduled', 'published'] as const
export const contentItemType = ['post', 'page'] as const
export const commentStatus = ['pending', 'approved', 'rejected'] as const
export const guestbookStatus = ['unread', 'read'] as const
export const menuTarget = ['_self', '_blank'] as const
export const contentType = ['richtext', 'markdown', 'html'] as const
export const pageTemplate = ['default', 'blank'] as const
export const revisionStatus = ['draft', 'published'] as const
export const revisionTargetType = ['post', 'page'] as const
export const storageProvider = ['s3', 'r2', 'oss', 'cos'] as const
export const rateEventType = ['login_fail', 'comment', 'guestbook'] as const
export const userRole = ['owner', 'admin', 'editor'] as const
export const redirectType = ['301', '302', '307', '308'] as const
export const emailLogStatus = ['success', 'fail'] as const
export const emailEventType = ['new_comment', 'new_guestbook', 'test'] as const

export function isoNow() {
  return new Date().toISOString()
}
