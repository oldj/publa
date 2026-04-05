import { getAllSettings } from '@/server/services/settings'

interface SendResult {
  success: boolean
  error?: string
}

/** 通过 Resend 发送邮件 */
async function sendViaResend(
  apiKey: string,
  from: string,
  to: string[],
  subject: string,
  html: string,
): Promise<SendResult> {
  try {
    const { Resend } = await import('resend')
    const resend = new Resend(apiKey)
    const { error } = await resend.emails.send({ from, to, subject, html })
    if (error) {
      return { success: false, error: error.message }
    }
    return { success: true }
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    return { success: false, error: message || 'Resend send failed' }
  }
}

/** 通过 SMTP 发送邮件 */
async function sendViaSmtp(
  config: { host: string; port: number; username: string; password: string; encryption: string },
  from: string,
  to: string[],
  subject: string,
  html: string,
): Promise<SendResult> {
  const nodemailer = await import('nodemailer')
  const transporter = nodemailer.createTransport({
    host: config.host,
    port: config.port,
    secure: config.encryption === 'ssl',
    auth: { user: config.username, pass: config.password },
    ...(config.encryption === 'tls' ? { requireTLS: true } : {}),
  })
  try {
    await transporter.sendMail({ from, to, subject, html })
    return { success: true }
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    return { success: false, error: message || 'SMTP send failed' }
  }
}

/** 发送邮件，根据当前配置自动选择 Resend 或 SMTP */
export async function sendEmail(to: string[], subject: string, html: string): Promise<SendResult> {
  const s = await getAllSettings()
  const provider = s.emailProvider
  const from = s.emailSmtpFrom

  if (!from) {
    return { success: false, error: 'Email sender address not configured' }
  }

  if (provider === 'resend') {
    const apiKey = s.emailResendApiKey
    if (!apiKey) {
      return { success: false, error: 'Resend API key not configured' }
    }
    return sendViaResend(apiKey, from, to, subject, html)
  }

  if (provider === 'smtp') {
    const host = s.emailSmtpHost
    const port = parseInt(s.emailSmtpPort || '587', 10)
    const username = s.emailSmtpUsername
    const password = s.emailSmtpPassword
    const encryption = s.emailSmtpEncryption || 'tls'
    if (!host) {
      return { success: false, error: 'SMTP host not configured' }
    }
    return sendViaSmtp({ host, port, username, password, encryption }, from, to, subject, html)
  }

  return { success: false, error: 'Email provider not configured' }
}
