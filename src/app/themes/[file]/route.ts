import { getCurrentUser } from '@/server/auth'
import { listCustomStylesByIds } from '@/server/services/custom-styles'
import { getSetting } from '@/server/services/settings'
import { getThemeById } from '@/server/services/themes'
import { readFile } from 'fs/promises'
import { NextRequest, NextResponse } from 'next/server'
import { join } from 'path'

export const dynamic = 'force-dynamic'

const CSS_HEADERS = {
  'Content-Type': 'text/css; charset=utf-8',
  'Cache-Control': 'public, max-age=0, must-revalidate',
}

const builtinCache = new Map<string, string>()

async function loadBuiltinTheme(key: 'light' | 'dark'): Promise<string> {
  const cached = builtinCache.get(key)
  if (cached !== undefined) return cached
  const filePath = join(process.cwd(), 'src/styles/themes', `${key}.css`)
  const content = await readFile(filePath, 'utf-8')
  builtinCache.set(key, content)
  return content
}

function notFound() {
  return new NextResponse('Not Found', { status: 404 })
}

function cssResponse(content: string) {
  return new NextResponse(content, { headers: CSS_HEADERS })
}

/** 把指定的主题记录渲染为 CSS 文本 */
async function renderThemeById(themeId: number): Promise<string> {
  const theme = await getThemeById(themeId)
  if (!theme) return ''
  if (theme.builtinKey === 'light') return loadBuiltinTheme('light')
  if (theme.builtinKey === 'dark') return loadBuiltinTheme('dark')
  if (theme.builtinKey === 'blank') return ''
  return theme.css || ''
}

/** 读取当前选中的主题 id，返回对应 CSS 内容 */
async function renderActiveTheme(): Promise<string> {
  const activeThemeId = (await getSetting('activeThemeId')) as number | null
  if (!activeThemeId || typeof activeThemeId !== 'number') return ''
  return renderThemeById(activeThemeId)
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

  if (file === 'light.css' || file === 'dark.css') {
    try {
      const content = await loadBuiltinTheme(file === 'light.css' ? 'light' : 'dark')
      return cssResponse(content)
    } catch {
      return notFound()
    }
  }

  if (file === 'theme.css') {
    try {
      if (previewAllowed) {
        const previewId = Number(searchParams.get('preview'))
        if (Number.isInteger(previewId) && previewId > 0) {
          return cssResponse(await renderThemeById(previewId))
        }
      }
      return cssResponse(await renderActiveTheme())
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
