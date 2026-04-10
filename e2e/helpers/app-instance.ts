import {
  request,
  type APIRequestContext,
  type BrowserContextOptions,
  type TestInfo,
} from '@playwright/test'
import { spawn, type ChildProcess } from 'child_process'
import { randomBytes } from 'crypto'
import { once } from 'events'
import fs from 'fs'
import net from 'net'
import path from 'path'
import { getAdminPath } from '../../src/lib/admin-path'

const NEXT_BIN = path.join(process.cwd(), 'node_modules', 'next', 'dist', 'bin', 'next')
const E2E_TMP_DIR = path.join(process.cwd(), 'e2e', 'tmp')
const BUILD_ID_FILE = path.join(process.cwd(), '.next', 'BUILD_ID')
const DEFAULT_STARTUP_TIMEOUT_MS = 30_000

interface OwnerCredentials {
  username: string
  password: string
  email: string
}

export interface TestAppInstance {
  baseURL: string
  adminPath: string
  dbFile: string
  storageStatePath: string
  logFile: string
  request: APIRequestContext
  browserContextOptions: BrowserContextOptions
  credentials: OwnerCredentials
  adminUrl: (subpath?: string) => string
  cleanup: () => Promise<void>
}

interface CreateAppInstanceOptions {
  credentials?: Partial<OwnerCredentials>
  startupTimeoutMs?: number
}

interface StorageState {
  cookies?: Array<{
    name: string
    value: string
    domain?: string
    path?: string
    expires?: number
    httpOnly?: boolean
    secure?: boolean
    sameSite?: 'Strict' | 'Lax' | 'None'
  }>
  origins?: Array<{
    origin: string
    localStorage: Array<{ name: string; value: string }>
  }>
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

function sanitizeFileName(input: string): string {
  const normalized = Array.from(input.trim(), (char) => {
    const code = char.charCodeAt(0)
    if (code < 32) {
      return '-'
    }
    return char
  }).join('')

  return normalized
    .replace(/[<>:"/\\|?*]/g, '-')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
}

function formatTimestamp(date: Date): string {
  const pad = (value: number, length = 2) => String(value).padStart(length, '0')
  return [
    date.getFullYear(),
    pad(date.getMonth() + 1),
    pad(date.getDate()),
    '-',
    pad(date.getHours()),
    pad(date.getMinutes()),
    pad(date.getSeconds()),
    '-',
    pad(date.getMilliseconds(), 3),
  ].join('')
}

function ensureTmpDir() {
  fs.mkdirSync(E2E_TMP_DIR, { recursive: true })
}

function ensureBuildExists() {
  if (!fs.existsSync(BUILD_ID_FILE)) {
    throw new Error('缺少 .next/BUILD_ID，请先执行 `npm run test:e2e` 或 `next build`。')
  }
}

function makeAdminUrl(adminPath: string, subpath?: string): string {
  const base = `/${adminPath}`
  if (!subpath) return base
  return `${base}${subpath.startsWith('/') ? subpath : `/${subpath}`}`
}

function buildTestScopeName(testInfo: TestInfo): string {
  return testInfo.titlePath.join(' ')
}

function buildFileScopeName(testInfo: TestInfo, label = 'shared'): string {
  return `${path.basename(testInfo.file, path.extname(testInfo.file))} ${label}`
}

function buildArtifactPaths(scopeName: string) {
  const prefix = `${sanitizeFileName(scopeName) || 'e2e'}-${formatTimestamp(new Date())}`
  return {
    prefix,
    dbFile: path.join(E2E_TMP_DIR, `${prefix}.sqlite`),
    storageStatePath: path.join(E2E_TMP_DIR, `${prefix}.auth.json`),
    logFile: path.join(E2E_TMP_DIR, `${prefix}.server.log`),
  }
}

async function allocatePort(): Promise<number> {
  return new Promise((resolve, reject) => {
    const server = net.createServer()
    server.unref()
    server.on('error', reject)
    server.listen(0, '127.0.0.1', () => {
      const address = server.address()
      if (!address || typeof address === 'string') {
        server.close()
        reject(new Error('无法分配端口'))
        return
      }

      const { port } = address
      server.close((error) => {
        if (error) {
          reject(error)
          return
        }
        resolve(port)
      })
    })
  })
}

async function waitForServerReady(
  baseURL: string,
  server: ChildProcess,
  timeoutMs: number,
  logFile: string,
) {
  const deadline = Date.now() + timeoutMs

  while (Date.now() < deadline) {
    if (server.exitCode !== null) {
      throw new Error(`Next 实例提前退出，请检查日志：${logFile}`)
    }

    try {
      const response = await fetch(`${baseURL}/setup`, { redirect: 'manual' })
      if (response.status < 500) {
        return
      }
    } catch {
      // 服务尚未就绪，继续轮询
    }

    await sleep(250)
  }

  throw new Error(`等待 Next 实例启动超时，请检查日志：${logFile}`)
}

async function stopServer(server: ChildProcess, logStream: fs.WriteStream) {
  if (server.exitCode === null) {
    server.kill('SIGTERM')
    await Promise.race([once(server, 'exit'), sleep(5_000)])
  }

  if (server.exitCode === null) {
    server.kill('SIGKILL')
    await once(server, 'exit')
  }

  await new Promise<void>((resolve) => {
    logStream.end(() => resolve())
  })
}

async function initializeOwner(
  baseURL: string,
  credentials: OwnerCredentials,
  storageStatePath: string,
): Promise<APIRequestContext> {
  const bootstrapContext = await request.newContext({
    baseURL,
    extraHTTPHeaders: { Accept: 'application/json' },
  })

  const response = await bootstrapContext.post('/api/setup', {
    data: credentials,
    failOnStatusCode: false,
  })
  const json = (await response.json()) as { success: boolean; message?: string }

  if (!response.ok() || !json.success) {
    await bootstrapContext.dispose()
    throw new Error(json.message || '初始化测试账号失败')
  }

  const storageState = (await bootstrapContext.storageState()) as StorageState
  const normalizedState: StorageState = {
    ...storageState,
    cookies: (storageState.cookies || []).map((cookie) => ({
      ...cookie,
      // `next start` 运行在 production 模式下会写 secure cookie，这里降为非 secure，
      // 以便当前基于 http://127.0.0.1 的本地 E2E 会话能够复用登录态。
      secure: false,
    })),
  }

  fs.writeFileSync(storageStatePath, `${JSON.stringify(normalizedState, null, 2)}\n`, 'utf8')
  await bootstrapContext.dispose()

  return request.newContext({
    baseURL,
    storageState: storageStatePath,
    extraHTTPHeaders: { Accept: 'application/json' },
  })
}

export async function createAppInstance(
  scopeName: string,
  options: CreateAppInstanceOptions = {},
): Promise<TestAppInstance> {
  ensureBuildExists()
  ensureTmpDir()

  const credentials: OwnerCredentials = {
    username: options.credentials?.username ?? 'e2e-owner',
    password: options.credentials?.password ?? 'e2e-password',
    email: options.credentials?.email ?? 'e2e@example.com',
  }
  const port = await allocatePort()
  const { dbFile, storageStatePath, logFile } = buildArtifactPaths(scopeName)
  const adminPath = getAdminPath()
  const baseURL = `http://127.0.0.1:${port}`
  const logStream = fs.createWriteStream(logFile, { flags: 'a' })
  const env = {
    ...process.env,
    DATABASE_URL: `file:${dbFile}`,
    JWT_SECRET: randomBytes(32).toString('hex'),
    VERCEL: '1',
    NEXT_TELEMETRY_DISABLED: '1',
    NEXT_PUBLIC_E2E: '1',
    PORT: String(port),
    HOSTNAME: '127.0.0.1',
    ADMIN_PATH: process.env.ADMIN_PATH ?? 'admin',
  }
  const server = spawn(
    process.execPath,
    [NEXT_BIN, 'start', '-H', '127.0.0.1', '-p', String(port)],
    {
      cwd: process.cwd(),
      env,
      stdio: ['ignore', 'pipe', 'pipe'],
    },
  )

  if (!server.stdout || !server.stderr) {
    throw new Error('Next 实例日志管道初始化失败')
  }

  server.stdout.pipe(logStream)
  server.stderr.pipe(logStream)

  let apiContext: APIRequestContext | null = null
  let cleanedUp = false

  try {
    await waitForServerReady(
      baseURL,
      server,
      options.startupTimeoutMs ?? DEFAULT_STARTUP_TIMEOUT_MS,
      logFile,
    )
    apiContext = await initializeOwner(baseURL, credentials, storageStatePath)

    return {
      baseURL,
      adminPath,
      dbFile,
      storageStatePath,
      logFile,
      request: apiContext,
      browserContextOptions: {
        baseURL,
        storageState: storageStatePath,
      },
      credentials,
      adminUrl: (subpath?: string) => makeAdminUrl(adminPath, subpath),
      cleanup: async () => {
        if (cleanedUp) return
        cleanedUp = true
        await apiContext?.dispose()
        await stopServer(server, logStream)
      },
    }
  } catch (error) {
    await apiContext?.dispose()
    await stopServer(server, logStream)
    throw error
  }
}

export async function setupPerTestApp(
  testInfo: TestInfo,
  options?: CreateAppInstanceOptions,
): Promise<TestAppInstance> {
  return createAppInstance(buildTestScopeName(testInfo), options)
}

export async function setupPerFileApp(
  testInfo: TestInfo,
  options: CreateAppInstanceOptions & { label?: string } = {},
): Promise<TestAppInstance> {
  return createAppInstance(buildFileScopeName(testInfo, options.label), options)
}
