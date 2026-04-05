import { runDailyTasks } from '@/cron/1d'
import { NextRequest, NextResponse } from 'next/server'

/** 每日定时任务（可由外部手动调用） */
export async function GET(request: NextRequest) {
  const expectedSecret = process.env.CRON_SECRET?.trim()

  if (!expectedSecret && process.env.NODE_ENV === 'production') {
    return NextResponse.json(
      { success: false, code: 'CONFIGURATION_ERROR', message: 'CRON_SECRET is not configured' },
      { status: 503 },
    )
  }

  const secret =
    request.headers.get('authorization')?.replace(/^Bearer\s+/i, '') ||
    request.headers.get('x-cron-secret')
  if (expectedSecret && secret !== expectedSecret) {
    return NextResponse.json(
      { success: false, code: 'UNAUTHORIZED', message: 'Invalid cron secret' },
      { status: 401 },
    )
  }

  await runDailyTasks()

  return NextResponse.json({ success: true })
}
