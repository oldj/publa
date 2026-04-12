import { runDailyTasks } from '@/cron/1d'
import { jsonError, jsonSuccess } from '@/server/lib/api-response'
import { NextRequest } from 'next/server'

/** 每日定时任务（可由外部手动调用） */
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

  const secret =
    request.headers.get('authorization')?.replace(/^Bearer\s+/i, '') ||
    request.headers.get('x-cron-secret')
  if (expectedSecret && secret !== expectedSecret) {
    return jsonError({
      source: request,
      namespace: 'common.api',
      key: 'invalidCronSecret',
      code: 'UNAUTHORIZED',
      status: 401,
    })
  }

  await runDailyTasks()

  return jsonSuccess()
}
