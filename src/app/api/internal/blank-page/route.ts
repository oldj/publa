import { getCurrentUser } from '@/server/auth'
import { getPublishedPageByPath } from '@/server/services/pages'
import { getPreviewPage, parsePreviewId } from '@/server/services/preview'

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const path = searchParams.get('path') || ''
  if (!path) return Response.json({ blank: false })

  try {
    // 预览模式
    const previewId = parsePreviewId(path)
    if (previewId !== null) {
      const user = await getCurrentUser()
      if (!user) return Response.json({ blank: false })

      const page = await getPreviewPage(previewId)
      if (page?.template === 'blank') {
        return Response.json({ blank: true, html: page.contentHtml, mimeType: page.mimeType })
      }
      return Response.json({ blank: false })
    }

    // 已发布页面
    const page = await getPublishedPageByPath(path)
    if (page?.template === 'blank') {
      return Response.json({ blank: true, html: page.contentHtml, mimeType: page.mimeType })
    }
    return Response.json({ blank: false })
  } catch {
    return Response.json({ blank: false })
  }
}
