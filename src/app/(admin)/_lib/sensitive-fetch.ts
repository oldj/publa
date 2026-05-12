'use client'

import myModal from '@/app/(admin)/_components/myModals'

type SensitiveJsonFetchInput = string | URL
type SensitiveJsonFetchInit = Omit<NonNullable<Parameters<typeof fetch>[1]>, 'body'> & {
  body?: string | null
}

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

function isJsonStringBody(body: unknown): boolean {
  return body == null || typeof body === 'string'
}

/** 仅用于 JSON 字符串 body 或无 body 的敏感请求；文件上传等非 JSON 请求请先 ensureReauth()。 */
export async function sensitiveJsonFetch(
  input: SensitiveJsonFetchInput,
  init?: SensitiveJsonFetchInit,
) {
  if (!isJsonStringBody(init?.body)) {
    throw new TypeError(
      'sensitiveJsonFetch only supports string JSON bodies or no body. ' +
        'Call ensureReauth() manually before non-JSON requests such as FormData or ReadableStream.',
    )
  }

  const firstResponse = await fetch(input, init)
  if (!(await isReauthRequired(firstResponse))) return firstResponse

  if (!(await ensureReauth({ verifyCurrent: false }))) return firstResponse
  return fetch(input, init)
}
