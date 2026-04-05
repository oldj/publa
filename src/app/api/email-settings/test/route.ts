import { requireRole } from '@/server/auth'
import { safeParseJson } from '@/server/lib/request'
import { createEmailLog } from '@/server/services/email-logs'
import { sendEmail } from '@/server/services/email-sender'
import { NextRequest, NextResponse } from 'next/server'

export async function POST(request: NextRequest) {
  const guard = await requireRole(['owner', 'admin'])
  if (!guard.ok) return guard.response

  const { data: body, error } = await safeParseJson(request)
  if (error) return error

  const to = typeof body.to === 'string' ? body.to.trim() : ''
  if (!to) {
    return NextResponse.json(
      { success: false, code: 'VALIDATION_ERROR', message: '请填写收件人邮箱' },
      { status: 400 },
    )
  }
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(to)) {
    return NextResponse.json(
      { success: false, code: 'VALIDATION_ERROR', message: '邮箱格式不正确' },
      { status: 400 },
    )
  }

  const subject = '测试邮件 - Publa'
  const html = `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"></head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; color: #333;">
  <h2 style="color: #1a1a1a;">邮件配置测试</h2>
  <p>如果你收到了这封邮件，说明邮件发送配置正确。</p>
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
    return NextResponse.json(
      { success: false, code: 'SEND_FAILED', message: result.error || '发送失败' },
      { status: 500 },
    )
  }

  return NextResponse.json({ success: true })
}
