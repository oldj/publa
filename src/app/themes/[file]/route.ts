import { getCurrentUser } from '@/server/auth'
import { getBuiltinKeyById } from '@/server/services/builtin-themes'
import { listCustomStylesByIds } from '@/server/services/custom-styles'
import { getSetting } from '@/server/services/settings'
import { getThemeById } from '@/server/services/themes'
import { type BuiltinKey, isBuiltinKey } from '@/shared/builtin-themes'
import { NextRequest, NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'

const CSS_HEADERS = {
  'Content-Type': 'text/css; charset=utf-8',
  // private: 预览请求携带登录态，禁止 CDN / 共享代理缓存，避免跨用户泄漏
  'Cache-Control': 'private, max-age=0, must-revalidate',
}

function notFound() {
  return new NextResponse('Not Found', { status: 404 })
}

function cssResponse(content: string) {
  return new NextResponse(content, { headers: CSS_HEADERS })
}

/**
 * 内置 light/dark 主题的实际文件位于 public/themes 下，由 Next.js 静态资源层直接伺服，
 * 不会进入本 handler。这里仅在 theme.css 路由（含预览）命中内置主题时做一次 302 临时重定向，
 * 既是防御性兜底，也覆盖 PreviewStyles 用 ?preview={id} 预览内置主题的场景。
 *
 * Location 用绝对路径（相对根），让浏览器基于当前请求的 scheme/host 拼装；
 * 避免反向代理场景下 NextResponse.redirect 把 request.url 的 http scheme 固化到 Location。
 */
function builtinRedirect(key: BuiltinKey) {
  if (key === 'blank') return cssResponse('')
  return new NextResponse(null, {
    status: 302,
    headers: { Location: `/themes/${key}.css` },
  })
}

/** 渲染自定义（非内置）主题的 CSS 内容，找不到或误为内置时返回空字符串 */
async function renderCustomThemeById(themeId: number): Promise<string> {
  const theme = await getThemeById(themeId)
  if (!theme || theme.builtinKey) return ''
  return theme.css || ''
}

/** 解析 "1,2,3" 形式的 id 列表，过滤非法项 */
function parseIdList(raw: string | null): number[] {
  if (!raw) return []
  return raw
    .split(',')
    .map((s) => Number(s.trim()))
    .filter((n) => Number.isInteger(n) && n > 0)
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ file: string }> },
) {
  const { file } = await params
  const { searchParams } = request.nextUrl
  // 仅登录用户可使用预览参数覆盖当前选中项
  const previewAllowed = Boolean(await getCurrentUser())

  if (file === 'theme.css') {
    try {
      if (previewAllowed) {
        const previewRaw = searchParams.get('preview')
        // preview 支持两种形态：
        // - 字符串 key（light/dark/blank/...）→ 不依赖 DB 中的 id 分配，未来新增或重排内置主题不影响协议
        // - 正整数 id → 指向自定义主题；若指向的 id 恰好是内置（旧 admin 构建产物兜底），也走 builtin 分支
        if (isBuiltinKey(previewRaw)) {
          return builtinRedirect(previewRaw)
        }
        const previewId = Number(previewRaw)
        if (Number.isInteger(previewId) && previewId > 0) {
          const builtinKey = await getBuiltinKeyById(previewId)
          if (builtinKey) return builtinRedirect(builtinKey)
          return cssResponse(await renderCustomThemeById(previewId))
        }
      }
      const activeThemeId = (await getSetting('activeThemeId')) as number | null
      if (typeof activeThemeId !== 'number' || activeThemeId <= 0) return cssResponse('')
      const builtinKey = await getBuiltinKeyById(activeThemeId)
      if (builtinKey) return builtinRedirect(builtinKey)
      // 不做兜底：id 指向的主题在库中不存在时返回空，让前台立即显示异常，便于用户及时发现数据不一致
      return cssResponse(await renderCustomThemeById(activeThemeId))
    } catch {
      return cssResponse('')
    }
  }

  if (file === 'custom.css') {
    let ids: number[] = []
    if (previewAllowed && searchParams.has('preview')) {
      ids = parseIdList(searchParams.get('preview'))
    } else {
      const stored = (await getSetting('activeCustomStyleIds')) as number[] | null
      ids = Array.isArray(stored) ? stored : []
    }
    if (ids.length === 0) return cssResponse('')
    const rows = await listCustomStylesByIds(ids)
    const content = rows.map((row) => `/* === ${row.name} === */\n${row.css}`).join('\n\n')
    return cssResponse(content)
  }

  return notFound()
}
