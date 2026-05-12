'use client'

import myModal from '@/app/(admin)/_components/myModals'

type SensitiveFetchInput = string | URL
type SensitiveFetchInit = Parameters<typeof fetch>[1]

async function isReauthRequired(response: Response): Promise<boolean> {
  try {
    const json = await response.clone().json()
    return json?.code === 'REAUTH_REQUIRED'
  } catch {
    return false
  }
}

export async function ensureReauth(options: { verifyCurrent?: boolean } = {}): Promise<boolean> {
  if (options.verifyCurrent !== false) {
    try {
      const response = await fetch('/api/auth/reauth', { method: 'GET' })
      if (response.ok) return true
      if (!(await isReauthRequired(response))) return false
    } catch {
      // 状态探测失败时仍允许用户通过密码弹窗直接验证。
    }
  }

  return myModal.reauth()
}

/** 仅接受可安全重试的 URL 输入，避免 Request body stream 首次发送后无法重放。 */
export async function sensitiveFetch(input: SensitiveFetchInput, init?: SensitiveFetchInit) {
  const firstResponse = await fetch(input, init)
  if (!(await isReauthRequired(firstResponse))) return firstResponse

  if (!(await ensureReauth({ verifyCurrent: false }))) return firstResponse
  return fetch(input, init)
}
