'use client'

import myModal from '@/app/(admin)/_components/myModals'

type SensitiveFetchInput = string | URL
type SensitiveFetchInit = Parameters<typeof fetch>[1]
type SensitiveFetchBody = NonNullable<SensitiveFetchInit>['body']

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

function isReplayableBody(body: SensitiveFetchBody): boolean {
  if (body == null) return true
  // string / URLSearchParams / Blob / ArrayBuffer / TypedArray 都可被 fetch 重复读取；
  // ReadableStream 与 FormData（含 File 流）首次发送后无法重放，禁止用于二次验证重试。
  if (typeof body === 'string') return true
  if (body instanceof URLSearchParams) return true
  if (typeof Blob !== 'undefined' && body instanceof Blob) return true
  if (body instanceof ArrayBuffer) return true
  if (ArrayBuffer.isView(body)) return true
  return false
}

/** 仅接受可安全重试的 URL 输入与可重放 body，避免 Request body stream 首次发送后无法重放。 */
export async function sensitiveFetch(input: SensitiveFetchInput, init?: SensitiveFetchInit) {
  if (!isReplayableBody(init?.body)) {
    throw new TypeError(
      'sensitiveFetch only supports replayable bodies (string/URLSearchParams/Blob/ArrayBuffer). ' +
        'Avoid passing FormData or ReadableStream — call ensureReauth() manually before the request instead.',
    )
  }

  const firstResponse = await fetch(input, init)
  if (!(await isReauthRequired(firstResponse))) return firstResponse

  if (!(await ensureReauth({ verifyCurrent: false }))) return firstResponse
  return fetch(input, init)
}
