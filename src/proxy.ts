import { getAdminPath } from '@/lib/admin-path'
import { AUTH_COOKIE_NAME, getJwtSecret, isAuthConfigError } from '@/server/auth/shared'
import { jwtVerify } from 'jose'
import { NextRequest, NextResponse } from 'next/server'

const ADMIN_PATH = getAdminPath()
const IS_CUSTOM_ADMIN = ADMIN_PATH !== 'admin'

// 不可能是自定义页面的路径前缀（静态资源目录 _next、uploads 等已包含在内）
// ADMIN_PATH 经过 SLUG_PATTERN 校验，只含 [a-zA-Z0-9_-]，可安全拼入正则
const SKIP_BLANK_CHECK = new RegExp(
  `^/(admin|${IS_CUSTOM_ADMIN ? ADMIN_PATH + '|' : ''}api|_next|posts|setup|uploads|category|tag|guestbook|__not_found)(/|$)`,
)

// 合法 MIME 类型格式：type/subtype
const MIME_PATTERN = /^[a-z]+\/[a-z0-9.+_-]+$/i
// 需要追加 charset=utf-8 的 MIME 类型
const CHARSET_TYPES = /^text\/|^application\/(json|javascript|xml|xhtml\+xml)$/

/** 校验 /admin 区域的 token，返回错误响应或 null（通过） */
async function checkAdminAuth(
  request: NextRequest,
  loginUrl: string,
): Promise<NextResponse | null> {
  const token = request.cookies.get(AUTH_COOKIE_NAME)?.value

  if (!token) {
    return NextResponse.redirect(new URL(loginUrl, request.url))
  }

  try {
    await jwtVerify(token, getJwtSecret())
  } catch (error) {
    if (isAuthConfigError(error)) {
      return new NextResponse('Authentication is unavailable.', { status: 503 })
    }

    // token 无效或过期
    const response = NextResponse.redirect(new URL(loginUrl, request.url))
    response.cookies.delete(AUTH_COOKIE_NAME)
    return response
  }

  return null
}

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl

  // --- 自定义后台路径处理 ---
  if (IS_CUSTOM_ADMIN) {
    const customPrefix = `/${ADMIN_PATH}`

    // 访问自定义路径：认证 + rewrite 到内部 /admin
    if (pathname === customPrefix || pathname.startsWith(customPrefix + '/')) {
      const subPath = pathname.slice(customPrefix.length) || ''
      const internalPath = `/admin${subPath}`
      const loginPath = `${customPrefix}/login`

      // 登录页不需要认证
      if (subPath !== '/login') {
        const authResponse = await checkAdminAuth(request, loginPath)
        if (authResponse) return authResponse
      }

      // rewrite 到内部 /admin 路由，设置 x-pathname 为内部路径
      const rewriteUrl = request.nextUrl.clone()
      rewriteUrl.pathname = internalPath
      return NextResponse.rewrite(rewriteUrl, {
        request: {
          headers: new Headers([...request.headers.entries(), ['x-pathname', internalPath]]),
        },
      })
    }

    // 屏蔽旧的 /admin 路径：rewrite 到不存在的路径，由 Next.js 渲染自定义 404 页面
    if (pathname === '/admin' || pathname.startsWith('/admin/')) {
      return NextResponse.rewrite(new URL('/__not_found', request.url))
    }
  } else {
    // 默认行为：保护 /admin 路由（登录页除外）
    if (pathname.startsWith('/admin') && !pathname.startsWith('/admin/login')) {
      const authResponse = await checkAdminAuth(request, '/admin/login')
      if (authResponse) return authResponse
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
