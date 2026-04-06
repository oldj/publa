import { AUTH_COOKIE_NAME, getJwtSecret, isAuthConfigError } from '@/server/auth/shared'
import { jwtVerify } from 'jose'
import { NextRequest, NextResponse } from 'next/server'

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl

  // 保护 /admin 路由（登录页除外）
  if (pathname.startsWith('/admin') && !pathname.startsWith('/admin/login')) {
    const token = request.cookies.get(AUTH_COOKIE_NAME)?.value

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
      response.cookies.delete(AUTH_COOKIE_NAME)
      return response
    }
  }

  return NextResponse.next()
}

export const config = {
  matcher: ['/admin/:path*', '/setup'],
}
