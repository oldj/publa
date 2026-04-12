import { describe, expect, it } from 'vitest'
import { getClientErrorMessage, isClientNetworkError } from './client-error'

describe('isClientNetworkError', () => {
  it('识别浏览器原生网络错误', () => {
    expect(isClientNetworkError(new Error('Failed to fetch'))).toBe(true)
    expect(isClientNetworkError(new Error('Load failed'))).toBe(true)
    expect(isClientNetworkError(new Error('NetworkError when attempting to fetch resource.'))).toBe(
      true,
    )
  })

  it('忽略普通业务错误', () => {
    expect(isClientNetworkError(new Error('Upload failed'))).toBe(false)
    expect(isClientNetworkError('Failed to fetch')).toBe(false)
  })
})

describe('getClientErrorMessage', () => {
  it('网络错误时返回统一网络提示', () => {
    expect(
      getClientErrorMessage(new Error('Failed to fetch'), {
        networkMessage: '网络错误',
        fallbackMessage: '上传失败',
      }),
    ).toBe('网络错误')
  })

  it('普通错误时优先返回原始 message', () => {
    expect(
      getClientErrorMessage(new Error('业务错误'), {
        networkMessage: '网络错误',
        fallbackMessage: '上传失败',
      }),
    ).toBe('业务错误')
  })

  it('未知错误时回退到 fallback', () => {
    expect(
      getClientErrorMessage(null, {
        networkMessage: '网络错误',
        fallbackMessage: '上传失败',
      }),
    ).toBe('上传失败')
  })
})
