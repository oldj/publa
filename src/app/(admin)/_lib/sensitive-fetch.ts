'use client'

import myModal from '@/app/(admin)/_components/myModals'

type SensitiveFetchInput = string | URL
type SensitiveJsonFetchInit = Omit<NonNullable<Parameters<typeof fetch>[1]>, 'body'> & {
  body?: string | null
}
type SensitiveUploadInit = Omit<NonNullable<Parameters<typeof fetch>[1]>, 'body'> & {
  body: FormData | Blob
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

/** 仅用于 JSON 字符串 body 或无 body 的敏感请求；文件上传请用 sensitiveUploadFetch。 */
export async function sensitiveJsonFetch(
  input: SensitiveFetchInput,
  init?: SensitiveJsonFetchInit,
) {
  if (!isJsonStringBody(init?.body)) {
    throw new TypeError(
      'sensitiveJsonFetch only supports string JSON bodies or no body. ' +
        'Use sensitiveUploadFetch for FormData / Blob uploads.',
    )
  }

  const firstResponse = await fetch(input, init)
  if (!(await isReauthRequired(firstResponse))) return firstResponse

  if (!(await ensureReauth({ verifyCurrent: false }))) return firstResponse
  return fetch(input, init)
}

/**
 * 用于 FormData / Blob 上传的敏感请求：
 * 与 sensitiveJsonFetch 同样实现「探测 → 弹窗 → 重试」语义，
 * 解决「先 ensureReauth + 裸 fetch」无法处理服务端期间凭据失效场景的问题。
 *
 * 注意：FormData 是一次性可读流，第一次 fetch 后流可能耗尽，重试需要复用同一份引用——
 * 在主流浏览器/Node 实现中 FormData 可被多次序列化，Blob 同理；若调用方传入会被消费的流体，
 * 自行确保可重读。
 */
export async function sensitiveUploadFetch(input: SensitiveFetchInput, init: SensitiveUploadInit) {
  const firstResponse = await fetch(input, init)
  if (!(await isReauthRequired(firstResponse))) return firstResponse

  if (!(await ensureReauth({ verifyCurrent: false }))) return firstResponse
  return fetch(input, init)
}
