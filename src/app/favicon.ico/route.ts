import { resolveFaviconAsset } from '@/server/services/favicon'
import { NextRequest, NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'

function createCacheControl(hasVersion: boolean): string {
  if (hasVersion) return 'public, max-age=31536000, immutable'
  return 'public, max-age=0, must-revalidate'
}

function createNotModifiedResponse(etag: string, cacheControl: string) {
  return new NextResponse(null, {
    status: 304,
    headers: {
      ETag: etag,
      'Cache-Control': cacheControl,
    },
  })
}

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const hasVersion = searchParams.has('v')
  const cacheControl = createCacheControl(hasVersion)
  const ifNoneMatch = request.headers.get('if-none-match')

  const asset = await resolveFaviconAsset()

  if (ifNoneMatch && ifNoneMatch.includes(asset.etag)) {
    return createNotModifiedResponse(asset.etag, cacheControl)
  }

  if (asset.kind === 'redirect') {
    const response = NextResponse.redirect(asset.location, { status: 307 })
    response.headers.set('ETag', asset.etag)
    response.headers.set('Cache-Control', cacheControl)
    return response
  }

  return new NextResponse(new Uint8Array(asset.body), {
    headers: {
      'Content-Type': asset.contentType,
      'Content-Length': String(asset.body.length),
      ETag: asset.etag,
      'Cache-Control': cacheControl,
    },
  })
}
