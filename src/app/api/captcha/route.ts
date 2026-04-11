import { NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { generateCaptcha } from '@/server/lib/captcha'
import { nanoid } from 'nanoid'

export async function GET() {
  const cookieStore = await cookies()
  let sessionId = cookieStore.get('captcha_session')?.value

  if (!sessionId) {
    sessionId = nanoid()
    cookieStore.set('captcha_session', sessionId, {
      httpOnly: true,
      maxAge: 600,
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
