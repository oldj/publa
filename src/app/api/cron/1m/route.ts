import { runOneMinuteTasks } from '@/cron/1m'
import { jsonError, jsonSuccess } from '@/server/lib/api-response'
import { NextRequest } from 'next/server'

/** 每分钟定时任务（可由外部手动调用） */
export async function GET(request: NextRequest) {
  const expectedSecret = process.env.CRON_SECRET?.trim()

  if (!expectedSecret && process.env.NODE_ENV === 'production') {
    return jsonError({
      source: request,
      namespace: 'common.api',
      key: 'cronSecretNotConfigured',
      code: 'CONFIGURATION_ERROR',
      status: 503,
    })
  }

  // 简单的密钥校验，防止外部滥用
  // 兼容 Vercel Cron 的 Authorization: Bearer <secret> 格式
  const secret =
    request.headers.get('authorization')?.replace(/^Bearer\s+/i, '') ||
    request.headers.get('x-cron-secret') ||
    request.nextUrl.searchParams.get('secret')
  if (expectedSecret && secret !== expectedSecret) {
    return jsonError({
      source: request,
      namespace: 'common.api',
      key: 'invalidCronSecret',
      code: 'UNAUTHORIZED',
      status: 401,
    })
  }

  await runOneMinuteTasks()

  return jsonSuccess()
}
