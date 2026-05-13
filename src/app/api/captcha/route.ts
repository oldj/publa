import { NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { CAPTCHA_TTL_SECONDS, generateCaptcha } from '@/server/lib/captcha'
import { nanoid } from 'nanoid'

export async function GET() {
  const cookieStore = await cookies()
  let sessionId = cookieStore.get('captcha_session')?.value

  if (!sessionId) {
    sessionId = nanoid()
    cookieStore.set('captcha_session', sessionId, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: CAPTCHA_TTL_SECONDS,
      path: '/',
    })
  }

  const svg = await generateCaptcha(sessionId)

  return new NextResponse(svg, {
    headers: {
      'Content-Type': 'image/svg+xml',
      'Cache-Control': 'no-cache, no-store',
    },
  })
}
