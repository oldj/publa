import { resolve } from 'path'
import nextEnvConfig from '@next/env'
import { configDefaults, defineConfig } from 'vitest/config'

export default defineConfig(() => {
  const { combinedEnv } = nextEnvConfig.loadEnvConfig(process.cwd(), false, console, true)
  const {
    DATABASE_URL: _databaseUrl,
    DATABASE_AUTH_TOKEN: _databaseAuthToken,
    ...nextEnv
  } = combinedEnv
  const testEnv = { ...nextEnv }

  return {
    resolve: {
      alias: {
        '@': resolve(import.meta.dirname, 'src'),
      },
    },
    test: {
      globals: true,
      env: testEnv,
      exclude: [...configDefaults.exclude, 'e2e/**/*'],
    },
  }
})
