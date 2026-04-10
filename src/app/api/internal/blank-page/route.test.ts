import { beforeEach, describe, expect, it } from 'vitest'
import { setupTestDb } from '@/server/services/__test__/setup'
import { seed } from '@/server/db/seed'

const { GET } = await import('./route')

describe('/api/internal/blank-page', () => {
  beforeEach(async () => {
    await setupTestDb()
    await seed()
  })

  it('初始化后访问 robots.txt 返回纯文本内容', async () => {
    const request = new Request('http://localhost/api/internal/blank-page?path=robots.txt')
    const response = await GET(request)
    const json = await response.json()

    expect(json).toEqual({
      blank: true,
      html: 'User-agent: *\nDisallow:',
      mimeType: 'text/plain',
    })
  })

  it('不存在的路径返回 blank: false', async () => {
    const request = new Request('http://localhost/api/internal/blank-page?path=no-such-page')
    const response = await GET(request)
    const json = await response.json()

    expect(json).toEqual({ blank: false })
  })
})
