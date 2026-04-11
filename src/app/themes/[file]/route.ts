import { listCustomStylesByIds } from '@/server/services/custom-styles'
import { getSetting } from '@/server/services/settings'
import { getThemeById } from '@/server/services/themes'
import { readFile } from 'fs/promises'
import { NextResponse } from 'next/server'
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

/** 根据当前选中的主题返回对应 CSS 内容 */
async function renderActiveTheme(): Promise<string> {
  const activeThemeId = (await getSetting('activeThemeId')) as number | null
  if (!activeThemeId || typeof activeThemeId !== 'number') return ''
  const theme = await getThemeById(activeThemeId)
  if (!theme) return ''

  if (theme.builtinKey === 'light') return loadBuiltinTheme('light')
  if (theme.builtinKey === 'dark') return loadBuiltinTheme('dark')
  if (theme.builtinKey === 'blank') return ''
  return theme.css || ''
}

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ file: string }> },
) {
  const { file } = await params

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
      return cssResponse(await renderActiveTheme())
    } catch {
      return cssResponse('')
    }
  }

  if (file === 'custom.css') {
    const ids = ((await getSetting('activeCustomStyleIds')) as number[] | null) ?? []
    if (!Array.isArray(ids) || ids.length === 0) {
      return cssResponse('')
    }
    const rows = await listCustomStylesByIds(ids)
    const content = rows.map((row) => `/* === ${row.name} === */\n${row.css}`).join('\n\n')
    return cssResponse(content)
  }

  return notFound()
}
