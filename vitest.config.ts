import { resolve } from 'path'
import { loadEnvConfig } from '@next/env'
import { configDefaults, defineConfig } from 'vitest/config'

export default defineConfig(() => {
  const { combinedEnv } = loadEnvConfig(process.cwd(), false, console, true)
  const {
    DATABASE_URL: _databaseUrl,
    DATABASE_AUTH_TOKEN: _databaseAuthToken,
    ...nextEnv
  } = combinedEnv
  const testEnv = { ...nextEnv }

  return {
    resolve: {
      alias: {
        '@': resolve(__dirname, 'src'),
      },
    },
    test: {
      globals: true,
      env: testEnv,
      exclude: [...configDefaults.exclude, 'e2e/**/*'],
    },
  }
})
