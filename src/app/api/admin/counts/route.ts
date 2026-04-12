import { requireCurrentUser } from '@/server/auth'
import { jsonSuccess } from '@/server/lib/api-response'
import { countPendingComments } from '@/server/services/comments'
import { countUnreadGuestbookMessages } from '@/server/services/guestbook'

export async function GET() {
  const guard = await requireCurrentUser()
  if (!guard.ok) return guard.response

  const [pendingComments, unreadGuestbook] = await Promise.all([
    countPendingComments(),
    countUnreadGuestbookMessages(),
  ])

  return jsonSuccess({ pendingComments, unreadGuestbook })
}
