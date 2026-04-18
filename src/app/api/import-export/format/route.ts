import { requireRole } from '@/server/auth'
import { jsonSuccess } from '@/server/lib/api-response'
import { renderMarkdown } from '@/server/lib/markdown'
import fs from 'fs'
import path from 'path'

export async function GET() {
  const guard = await requireRole(['owner', 'admin'])
  if (!guard.ok) return guard.response

  const filePath = path.join(process.cwd(), 'src', 'docs', 'import-export-format.md')
  const md = fs.readFileSync(filePath, 'utf-8')
  const html = await renderMarkdown(md)
  return jsonSuccess({ md, html })
}
