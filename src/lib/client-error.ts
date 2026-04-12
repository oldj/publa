const NETWORK_ERROR_MESSAGES = new Set([
  'Failed to fetch',
  'Load failed',
  'NetworkError when attempting to fetch resource.',
])

export function isClientNetworkError(error: unknown): error is Error {
  return error instanceof Error && NETWORK_ERROR_MESSAGES.has(error.message)
}

/**
 * 统一把浏览器原生网络错误归一化为面向用户的提示，
 * 其余错误尽量保留已有业务 message。
 */
export function getClientErrorMessage(
  error: unknown,
  options: {
    networkMessage: string
    fallbackMessage: string
  },
) {
  if (isClientNetworkError(error)) {
    return options.networkMessage
  }

  if (error instanceof Error && error.message) {
    return error.message
  }

  return options.fallbackMessage
}
