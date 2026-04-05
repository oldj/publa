import { runOneMinuteTasks } from '@/cron/1m'
import { NextRequest, NextResponse } from 'next/server'

/** 每分钟定时任务（可由外部手动调用） */
export async function GET(request: NextRequest) {
  const expectedSecret = process.env.CRON_SECRET?.trim()

  if (!expectedSecret && process.env.NODE_ENV === 'production') {
    return NextResponse.json(
      { success: false, code: 'CONFIGURATION_ERROR', message: 'CRON_SECRET is not configured' },
      { status: 503 },
    )
  }

  // 简单的密钥校验，防止外部滥用
  // 兼容 Vercel Cron 的 Authorization: Bearer <secret> 格式
  const secret =
    request.headers.get('authorization')?.replace(/^Bearer\s+/i, '') ||
    request.headers.get('x-cron-secret') ||
    request.nextUrl.searchParams.get('secret')
  if (expectedSecret && secret !== expectedSecret) {
    return NextResponse.json(
      { success: false, code: 'UNAUTHORIZED', message: 'Invalid cron secret' },
      { status: 401 },
    )
  }

  await runOneMinuteTasks()

  return NextResponse.json({ success: true })
}
