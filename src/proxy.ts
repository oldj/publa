import { getAdminPath } from '@/lib/admin-path'
import { AUTH_COOKIE_NAME, getJwtSecret, isAuthConfigError } from '@/server/auth/shared'
import { jwtVerify } from 'jose'
import { NextRequest, NextResponse } from 'next/server'

const ADMIN_PATH = getAdminPath()
const IS_CUSTOM_ADMIN = ADMIN_PATH !== 'admin'

// 对 /api 下的写方法强制同源校验，弥补 SameSite=lax 在部分场景下的 CSRF 缺口
const WRITE_METHODS = new Set(['POST', 'PUT', 'PATCH', 'DELETE'])

// 由外部定时器触发、无 Origin 的内部接口豁免 Origin 校验
const ORIGIN_CHECK_EXEMPT_PREFIXES = ['/api/cron']

function isOriginCheckExempt(pathname: string): boolean {
  for (const prefix of ORIGIN_CHECK_EXEMPT_PREFIXES) {
    if (pathname === prefix || pathname.startsWith(`${prefix}/`)) return true
  }
  return false
}

// 首选用 Sec-Fetch-Site 判定是否同源：
// - 这是浏览器强制设置的 Fetch Metadata 头（Forbidden Header），
//   脚本无法覆写，跨站攻击者也无法伪造，是最可靠的 CSRF 判据；
// - 不依赖服务器知道自己的 hostname，反代即使改写了 Host / 未转发
//   X-Forwarded-Host 也不影响判断；
// - 支持度：Chrome 76+ / Firefox 90+ / Safari 16.4+。
// 对更老的浏览器退回到 Origin hostname 比对。
function isSameOriginWrite(request: NextRequest): boolean {
  const secFetchSite = request.headers.get('sec-fetch-site')
  if (secFetchSite) {
    // same-origin：浏览器已判定同源；其它值（same-site / cross-site / none）一律拒绝
    return secFetchSite === 'same-origin'
  }
  return hasMatchingOriginHostname(request)
}

function hasMatchingOriginHostname(request: NextRequest): boolean {
  const origin = request.headers.get('origin')
  if (!origin) return false

  // 仅比较 hostname：CSRF 防御只需确认"同域"。跨 scheme（http/https）
  // 或显式端口差异在反代部署下会产生假阴性，真实 CSRF 攻击的源 hostname
  // 必然不同，因此 hostname 相同即可放行。
  let originHost: string
  try {
    originHost = new URL(origin).hostname
  } catch {
    return false
  }
  if (!originHost) return false

  // 期望 host：反代优先用 X-Forwarded-Host，其次 Host，兜底 nextUrl
  const rawHost =
    request.headers.get('x-forwarded-host') || request.headers.get('host') || request.nextUrl.host
  const expectedHost = rawHost.split(':')[0].toLowerCase()

  return originHost.toLowerCase() === expectedHost
}

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

  // --- /api 单独短路：仅做写方法同源校验，无需走后续 admin / blank-page 逻辑 ---
  if (pathname.startsWith('/api/')) {
    if (
      WRITE_METHODS.has(request.method) &&
      !isOriginCheckExempt(pathname) &&
      !isSameOriginWrite(request)
    ) {
      // 返回稳定错误码，前端按 code 翻译展示（proxy 阶段不走 i18n 翻译）
      return NextResponse.json({ success: false, code: 'FORBIDDEN_ORIGIN' }, { status: 403 })
    }
    // API 请求不需要 x-pathname / x-search 注入，直接放行
    return NextResponse.next()
  }

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
          headers: new Headers([
            ...request.headers.entries(),
            ['x-pathname', internalPath],
            ['x-search', request.nextUrl.search],
          ]),
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

  // 将路径与查询串传递给 Server Component，用于根布局条件渲染 customHeadHtml
  // 以及 i18n 的 setup 页面 ?lang= 覆盖解析
  return NextResponse.next({
    request: {
      headers: new Headers([
        ...request.headers.entries(),
        ['x-pathname', pathname],
        ['x-search', request.nextUrl.search],
      ]),
    },
  })
}

export const config = {
  matcher: [
    '/admin/:path*',
    '/setup',
    // 对 /api 写方法做 Origin 校验（proxy 内部会短路返回，不跑后续逻辑）
    '/api/:path*',
    '/((?!api|_next/static|_next/image|favicon\\.ico).*)',
  ],
}
