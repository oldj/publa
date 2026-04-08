import { AUTH_COOKIE_NAME, getJwtSecret, isAuthConfigError } from '@/server/auth/shared'
import { jwtVerify } from 'jose'
import { NextRequest, NextResponse } from 'next/server'

// 不可能是自定义页面的路径前缀（静态资源目录 _next、uploads 等已包含在内）
const SKIP_BLANK_CHECK = /^\/(admin|api|_next|posts|setup|uploads|category|tag|guestbook)(\/|$)/

// 合法 MIME 类型格式：type/subtype
const MIME_PATTERN = /^[a-z]+\/[a-z0-9.+_-]+$/i
// 需要追加 charset=utf-8 的 MIME 类型
const CHARSET_TYPES = /^text\/|^application\/(json|javascript|xml|xhtml\+xml)$/

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

  // 空白模板页面：直接返回纯 HTML，绕过 Next.js 渲染管线
  if (pathname !== '/' && !SKIP_BLANK_CHECK.test(pathname)) {
    try {
      const checkUrl = new URL('/api/internal/blank-page', request.url)
      checkUrl.searchParams.set('path', pathname.slice(1))

      const res = await fetch(checkUrl, {
        headers: { cookie: request.headers.get('cookie') || '' },
      })

      if (res.ok) {
        const data = await res.json()
        if (data.blank) {
          const mime =
            data.mimeType && MIME_PATTERN.test(data.mimeType) ? data.mimeType : 'text/html'
          const contentType = CHARSET_TYPES.test(mime) ? `${mime}; charset=utf-8` : mime
          return new NextResponse(data.html ?? '', {
            headers: { 'Content-Type': contentType },
          })
        }
      }
    } catch (error) {
      console.error('[proxy] blank-page check error:', error)
    }
  }

  // 将路径传递给 Server Component，用于根布局条件渲染 customHeadHtml
  return NextResponse.next({
    request: {
      headers: new Headers([...request.headers.entries(), ['x-pathname', pathname]]),
    },
  })
}

export const config = {
  matcher: ['/admin/:path*', '/setup', '/((?!api|_next/static|_next/image|favicon\\.ico).*)'],
}
