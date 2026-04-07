import { NextRequest, NextResponse } from 'next/server'
import { clearAuthCookie, getCurrentUser } from '@/server/auth'
import { logActivity } from '@/server/services/activity-logs'

export async function POST(request: NextRequest) {
  const user = await getCurrentUser()

  await clearAuthCookie()

  if (user) {
    await logActivity(request, user.id, 'logout')
  }

  return NextResponse.json({ success: true })
}
