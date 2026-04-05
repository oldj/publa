import { jwtVerify } from 'jose'
import { NextRequest, NextResponse } from 'next/server'
import { getJwtSecret, isAuthConfigError } from '@/server/auth/shared'

const COOKIE_NAME = 'blog_token'

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl

  // 保护 /admin 路由（登录页除外）
  if (pathname.startsWith('/admin') && !pathname.startsWith('/admin/login')) {
    const token = request.cookies.get(COOKIE_NAME)?.value

    if (!token) {
      return NextResponse.redirect(new URL('/admin/login', request.url))
    }

    try {
      await jwtVerify(token, getJwtSecret())
    } catch (error) {
      if (isAuthConfigError(error)) {
        return new NextResponse('Authentication is unavailable.', { status: 503 })
      }

      // token 无效或过期
      const response = NextResponse.redirect(new URL('/admin/login', request.url))
      response.cookies.delete(COOKIE_NAME)
      return response
    }
  }

  return NextResponse.next()
}

export const config = {
  matcher: ['/admin/:path*', '/setup'],
}
