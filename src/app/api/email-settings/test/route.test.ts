import { NextResponse } from 'next/server'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const { mockRequireRecentReauth, mockRequireRole } = vi.hoisted(() => ({
  mockRequireRecentReauth: vi.fn(),
  mockRequireRole: vi.fn(),
}))

vi.mock('@/server/auth', () => ({
  requireRecentReauth: mockRequireRecentReauth,
  requireRole: mockRequireRole,
}))

const { POST } = await import('./route')

describe('/api/email-settings/test POST', () => {
  beforeEach(() => {
    mockRequireRecentReauth.mockReset()
    mockRequireRole.mockReset()

    mockRequireRole.mockResolvedValue({
      ok: true,
      user: { id: 1, username: 'owner', role: 'owner' },
    })
    mockRequireRecentReauth.mockResolvedValue({ ok: true })
  })

  it('缺少二次验证时不能发送测试邮件', async () => {
    mockRequireRecentReauth.mockResolvedValueOnce({
      ok: false,
      response: NextResponse.json({ success: false, code: 'REAUTH_REQUIRED' }, { status: 403 }),
    })

    const response = await POST(
      new Request('http://localhost/api/email-settings/test', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ to: 'owner@example.com' }),
      }) as any,
    )
    const json = await response.json()

    expect(response.status).toBe(403)
    expect(json.code).toBe('REAUTH_REQUIRED')
  })
})
