import { requireRole } from '@/server/auth'
import { renderMarkdown } from '@/server/lib/markdown'
import fs from 'fs'
import path from 'path'
import { NextResponse } from 'next/server'

export async function GET() {
  const guard = await requireRole(['owner', 'admin'])
  if (!guard.ok) return guard.response

  const filePath = path.join(process.cwd(), 'src', 'docs', 'import-export-format.md')
  const md = fs.readFileSync(filePath, 'utf-8')
  const html = await renderMarkdown(md)
  return NextResponse.json({ success: true, data: { md, html } })
}
