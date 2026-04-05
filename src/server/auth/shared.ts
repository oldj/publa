const DEFAULT_JWT_SECRET = 'blog-jwt-secret-change-me'

export class AuthConfigError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'AuthConfigError'
  }
}

export function getJwtSecret(): Uint8Array {
  const raw = process.env.JWT_SECRET?.trim() || ''

  if (process.env.NODE_ENV === 'production' && (!raw || raw === DEFAULT_JWT_SECRET)) {
    throw new AuthConfigError('JWT_SECRET is not configured')
  }

  return new TextEncoder().encode(raw || DEFAULT_JWT_SECRET)
}

export function isAuthConfigError(error: unknown): error is AuthConfigError {
  return error instanceof AuthConfigError
}
