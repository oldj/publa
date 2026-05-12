import fs from 'fs'
import path from 'path'
import { redirectResponseOrNotFound } from '@/server/lib/frontend-404'
import { NextRequest, NextResponse } from 'next/server'

const UPLOAD_DIR = path.join(process.cwd(), 'data', 'uploads')
const RESOLVED_UPLOAD_DIR = path.resolve(UPLOAD_DIR)

const MIME_TYPES: Record<string, string> = {
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.png': 'image/png',
  '.gif': 'image/gif',
  '.webp': 'image/webp',
  '.svg': 'image/svg+xml',
  '.pdf': 'application/pdf',
  '.doc': 'application/msword',
  '.docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  '.zip': 'application/zip',
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ path: string[] }> },
) {
  const { path: pathSegments } = await params
  const filePath = path.resolve(RESOLVED_UPLOAD_DIR, ...pathSegments)
  const relativePath = path.relative(RESOLVED_UPLOAD_DIR, filePath)

  // 防止路径遍历攻击：拒绝 ..、绝对路径与跨盘符引用
  if (relativePath.startsWith('..') || path.isAbsolute(relativePath)) {
    return new NextResponse('Forbidden', { status: 403 })
  }

  if (!fs.existsSync(filePath)) {
    return redirectResponseOrNotFound(`/uploads/${pathSegments.join('/')}`, request)
  }

  // 纵深防御：解析符号链接后再次比对，避免上传目录被植入软链穿越到外部文件系统。
  // realpath 在目录不存在时会抛 ENOENT，需要 try/catch；上传目录本身也用 realpath 解析，
  // 兼容部署时把 data/uploads 配置为软链的合法用法。
  let realFilePath: string
  let realUploadDir: string
  try {
    realFilePath = fs.realpathSync(filePath)
    realUploadDir = fs.realpathSync(RESOLVED_UPLOAD_DIR)
  } catch {
    return new NextResponse('Forbidden', { status: 403 })
  }
  const realRelative = path.relative(realUploadDir, realFilePath)
  if (realRelative.startsWith('..') || path.isAbsolute(realRelative)) {
    return new NextResponse('Forbidden', { status: 403 })
  }

  const ext = path.extname(realFilePath).toLowerCase()
  const contentType = MIME_TYPES[ext] || 'application/octet-stream'
  const fileBuffer = fs.readFileSync(realFilePath)

  return new NextResponse(fileBuffer, {
    headers: {
      'Content-Type': contentType,
      'Cache-Control': 'public, max-age=31536000, immutable',
    },
  })
}
