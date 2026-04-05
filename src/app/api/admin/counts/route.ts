import { getCurrentUser } from '@/server/auth'
import { countPendingComments } from '@/server/services/comments'
import { countUnreadGuestbookMessages } from '@/server/services/guestbook'
import { NextResponse } from 'next/server'

export async function GET() {
  const user = await getCurrentUser()
  if (!user) {
    return NextResponse.json(
      { success: false, code: 'UNAUTHORIZED', message: 'Unauthorized' },
      { status: 401 },
    )
  }

  const [pendingComments, unreadGuestbook] = await Promise.all([
    countPendingComments(),
    countUnreadGuestbookMessages(),
  ])

  return NextResponse.json({
    success: true,
    data: { pendingComments, unreadGuestbook },
  })
}
