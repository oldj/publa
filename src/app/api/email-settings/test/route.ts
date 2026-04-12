import { requireRole } from '@/server/auth'
import { jsonError, jsonSuccess } from '@/server/lib/api-response'
import { safeParseJson } from '@/server/lib/request'
import { createEmailLog } from '@/server/services/email-logs'
import { sendEmail } from '@/server/services/email-sender'
import { getServerTranslator } from '@/i18n/server'
import { NextRequest } from 'next/server'

export async function POST(request: NextRequest) {
  const guard = await requireRole(['owner', 'admin'])
  if (!guard.ok) return guard.response

  const { data: body, error } = await safeParseJson(request)
  if (error) return error

  const to = typeof body.to === 'string' ? body.to.trim() : ''
  if (!to) {
    return jsonError({
      source: request,
      namespace: 'admin.api.email',
      key: 'recipientRequired',
      code: 'VALIDATION_ERROR',
      status: 400,
    })
  }
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(to)) {
    return jsonError({
      source: request,
      namespace: 'admin.api.email',
      key: 'invalidRecipient',
      code: 'VALIDATION_ERROR',
      status: 400,
    })
  }

  const { t } = await getServerTranslator('admin.api.email', { source: request })
  const subject = t('testSubject')
  const html = `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"></head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; color: #333;">
  <h2 style="color: #1a1a1a;">${t('testHeading')}</h2>
  <p>${t('testBody')}</p>
</body>
</html>`

  const result = await sendEmail([to], subject, html)

  await createEmailLog({
    eventType: 'test',
    recipients: [to],
    subject,
    status: result.success ? 'success' : 'fail',
    errorMessage: result.error,
  })

  if (!result.success) {
    return jsonError({
      source: request,
      namespace: 'admin.api.email',
      key: 'sendFailed',
      code: 'SEND_FAILED',
      status: 500,
    })
  }

  return jsonSuccess()
}
