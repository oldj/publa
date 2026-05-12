import { db } from '@/server/db'
import { rateEvents } from '@/server/db/schema'
import { and, count, eq, gte, lt } from 'drizzle-orm'

type RateEventType =
  | 'login_fail'
  | 'login_lock_username'
  | 'login_lock_ip'
  | 'reauth_fail'
  | 'reauth_lock_username'
  | 'reauth_lock_ip'
  | 'comment'
  | 'guestbook'
type LoginLockReason = 'username' | 'ip'

export interface LoginRateState {
  locked: boolean
  reason?: LoginLockReason
}

// reauth 与 login 阈值刻意一致：用户在两个表单输错密码的判定标准应当对齐，
// 但事件类型独立，避免「reauth 输错把 login 锁了」或反向干扰。
const LOGIN_USERNAME_WINDOW_MS = 5 * 60 * 1000
const LOGIN_USERNAME_LIMIT = 5
const LOGIN_USERNAME_LOCK_MS = 5 * 60 * 1000
const LOGIN_IP_WINDOW_MS = 10 * 60 * 1000
const LOGIN_IP_LIMIT = 30
const LOGIN_IP_LOCK_MS = 10 * 60 * 1000

interface CredentialLimitConfig {
  failType: RateEventType
  usernameLockType: RateEventType
  ipLockType: RateEventType
  usernameWindowMs: number
  usernameLimit: number
  usernameLockMs: number
  ipWindowMs: number
  ipLimit: number
  ipLockMs: number
}

const LOGIN_LIMIT_CONFIG: CredentialLimitConfig = {
  failType: 'login_fail',
  usernameLockType: 'login_lock_username',
  ipLockType: 'login_lock_ip',
  usernameWindowMs: LOGIN_USERNAME_WINDOW_MS,
  usernameLimit: LOGIN_USERNAME_LIMIT,
  usernameLockMs: LOGIN_USERNAME_LOCK_MS,
  ipWindowMs: LOGIN_IP_WINDOW_MS,
  ipLimit: LOGIN_IP_LIMIT,
  ipLockMs: LOGIN_IP_LOCK_MS,
}

const REAUTH_LIMIT_CONFIG: CredentialLimitConfig = {
  failType: 'reauth_fail',
  usernameLockType: 'reauth_lock_username',
  ipLockType: 'reauth_lock_ip',
  usernameWindowMs: LOGIN_USERNAME_WINDOW_MS,
  usernameLimit: LOGIN_USERNAME_LIMIT,
  usernameLockMs: LOGIN_USERNAME_LOCK_MS,
  ipWindowMs: LOGIN_IP_WINDOW_MS,
  ipLimit: LOGIN_IP_LIMIT,
  ipLockMs: LOGIN_IP_LOCK_MS,
}

// 同 IP 提交节流阈值（评论/留言共用）
// 取值经验：在挡住自动化批量提交的同时，允许 NAT/移动出口下多个真人共用一个出口 IP。
const IP_SHORT_WINDOW_MS = 60 * 1000
const IP_SHORT_LIMIT = 6
const IP_LONG_WINDOW_MS = 5 * 60 * 1000
const IP_LONG_LIMIT = 20

/** 记录一条速率事件 */
export async function recordRateEvent(
  eventType: RateEventType,
  identifier: string,
  ipAddress?: string,
) {
  await db.insert(rateEvents).values({ eventType, identifier, ipAddress })
}

async function countRecentFailuresByUsername(
  config: CredentialLimitConfig,
  username: string,
): Promise<number> {
  const threshold = new Date(Date.now() - config.usernameWindowMs).toISOString()
  const [row] = await db
    .select({ total: count() })
    .from(rateEvents)
    .where(
      and(
        eq(rateEvents.eventType, config.failType),
        eq(rateEvents.identifier, username),
        gte(rateEvents.createdAt, threshold),
      ),
    )
  return row?.total ?? 0
}

async function countRecentFailuresByIp(
  config: CredentialLimitConfig,
  ipAddress: string,
): Promise<number> {
  const threshold = new Date(Date.now() - config.ipWindowMs).toISOString()
  const [row] = await db
    .select({ total: count() })
    .from(rateEvents)
    .where(
      and(
        eq(rateEvents.eventType, config.failType),
        eq(rateEvents.ipAddress, ipAddress),
        gte(rateEvents.createdAt, threshold),
      ),
    )
  return row?.total ?? 0
}

async function hasActiveUsernameLock(
  config: CredentialLimitConfig,
  username: string,
): Promise<boolean> {
  const threshold = new Date(Date.now() - config.usernameLockMs).toISOString()
  const [row] = await db
    .select({ total: count() })
    .from(rateEvents)
    .where(
      and(
        eq(rateEvents.eventType, config.usernameLockType),
        eq(rateEvents.identifier, username),
        gte(rateEvents.createdAt, threshold),
      ),
    )
  return (row?.total ?? 0) > 0
}

async function hasActiveIpLock(
  config: CredentialLimitConfig,
  ipAddress: string,
): Promise<boolean> {
  const threshold = new Date(Date.now() - config.ipLockMs).toISOString()
  const [row] = await db
    .select({ total: count() })
    .from(rateEvents)
    .where(
      and(
        eq(rateEvents.eventType, config.ipLockType),
        eq(rateEvents.ipAddress, ipAddress),
        gte(rateEvents.createdAt, threshold),
      ),
    )
  return (row?.total ?? 0) > 0
}

async function createUsernameLockIfMissing(config: CredentialLimitConfig, username: string) {
  if (await hasActiveUsernameLock(config, username)) return
  await recordRateEvent(config.usernameLockType, username)
}

async function createIpLockIfMissing(config: CredentialLimitConfig, ipAddress: string) {
  if (await hasActiveIpLock(config, ipAddress)) return
  await recordRateEvent(config.ipLockType, ipAddress, ipAddress)
}

async function getCredentialRateState(
  config: CredentialLimitConfig,
  username: string,
  ipAddress?: string,
): Promise<LoginRateState> {
  if (await hasActiveUsernameLock(config, username)) {
    return { locked: true, reason: 'username' }
  }

  if (ipAddress && (await hasActiveIpLock(config, ipAddress))) {
    return { locked: true, reason: 'ip' }
  }

  return { locked: false }
}

async function enforceCredentialRateLimit(
  config: CredentialLimitConfig,
  username: string,
  ipAddress?: string,
): Promise<LoginRateState> {
  const activeState = await getCredentialRateState(config, username, ipAddress)
  if (activeState.locked) return activeState

  if ((await countRecentFailuresByUsername(config, username)) >= config.usernameLimit) {
    await createUsernameLockIfMissing(config, username)
    return { locked: true, reason: 'username' }
  }

  if (ipAddress && (await countRecentFailuresByIp(config, ipAddress)) >= config.ipLimit) {
    await createIpLockIfMissing(config, ipAddress)
    return { locked: true, reason: 'ip' }
  }

  return { locked: false }
}

async function recordCredentialFailure(
  config: CredentialLimitConfig,
  username: string,
  ipAddress?: string,
) {
  await recordRateEvent(config.failType, username, ipAddress)

  if ((await countRecentFailuresByUsername(config, username)) >= config.usernameLimit) {
    await createUsernameLockIfMissing(config, username)
  }

  if (ipAddress && (await countRecentFailuresByIp(config, ipAddress)) >= config.ipLimit) {
    await createIpLockIfMissing(config, ipAddress)
  }
}

async function clearCredentialFailures(config: CredentialLimitConfig, username: string) {
  await db
    .delete(rateEvents)
    .where(and(eq(rateEvents.eventType, config.failType), eq(rateEvents.identifier, username)))
}

/** 检查登录是否处于显式锁定期。 */
export async function getLoginRateState(
  username: string,
  ipAddress?: string,
): Promise<LoginRateState> {
  return getCredentialRateState(LOGIN_LIMIT_CONFIG, username, ipAddress)
}

/**
 * 执行登录限流检查。
 * 若历史失败记录已经达到阈值但还没有锁定事件，会补写锁定事件，保证从触发时起完整锁定。
 */
export async function enforceLoginRateLimit(
  username: string,
  ipAddress?: string,
): Promise<LoginRateState> {
  return enforceCredentialRateLimit(LOGIN_LIMIT_CONFIG, username, ipAddress)
}

/** 记录登录失败，并在达到阈值时创建锁定事件。 */
export async function recordLoginFailure(username: string, ipAddress?: string) {
  await recordCredentialFailure(LOGIN_LIMIT_CONFIG, username, ipAddress)
}

/** 登录成功后清理该用户名的失败记录，让限流体现连续失败语义。 */
export async function clearLoginFailures(username: string) {
  await clearCredentialFailures(LOGIN_LIMIT_CONFIG, username)
}

/** 检查登录是否被锁定。保留旧函数名，供测试和现有调用复用。 */
export async function isLoginLocked(username: string, ipAddress?: string): Promise<boolean> {
  return (await enforceLoginRateLimit(username, ipAddress)).locked
}

/** 二次验证限流：与 login 同阈值，但用独立事件类型，避免互相串扰。 */
export async function enforceReauthRateLimit(
  username: string,
  ipAddress?: string,
): Promise<LoginRateState> {
  return enforceCredentialRateLimit(REAUTH_LIMIT_CONFIG, username, ipAddress)
}

/** 二次验证失败计数。 */
export async function recordReauthFailure(username: string, ipAddress?: string) {
  await recordCredentialFailure(REAUTH_LIMIT_CONFIG, username, ipAddress)
}

/** 二次验证成功后清理失败记录，避免下次再触发同阈值锁。 */
export async function clearReauthFailures(username: string) {
  await clearCredentialFailures(REAUTH_LIMIT_CONFIG, username)
}

/**
 * 原子地检查并占位：在事务内查询 30 秒内是否有同类事件，
 * 若无则立即写入一条记录。返回 true 表示获取到提交槽位。
 * 利用 SQLite/PG 事务写锁防止并发穿透。
 */
export async function acquireSubmissionSlot(
  eventType: 'comment' | 'guestbook',
  sessionId: string,
  ipAddress?: string,
): Promise<boolean> {
  return db.transaction(async (tx) => {
    const now = Date.now()

    // 1) sessionId 维度：30 秒内不得重复（同一 captcha 会话）
    const sessionThreshold = new Date(now - 30 * 1000).toISOString()
    const [sessionRow] = await tx
      .select({ total: count() })
      .from(rateEvents)
      .where(
        and(
          eq(rateEvents.eventType, eventType),
          eq(rateEvents.identifier, sessionId),
          gte(rateEvents.createdAt, sessionThreshold),
        ),
      )
    if ((sessionRow?.total ?? 0) >= 1) return false

    // 2) IP 维度（仅当能拿到 IP 时）：清 cookie 也无法绕过
    if (ipAddress) {
      const shortThreshold = new Date(now - IP_SHORT_WINDOW_MS).toISOString()
      const [shortRow] = await tx
        .select({ total: count() })
        .from(rateEvents)
        .where(
          and(
            eq(rateEvents.eventType, eventType),
            eq(rateEvents.ipAddress, ipAddress),
            gte(rateEvents.createdAt, shortThreshold),
          ),
        )
      if ((shortRow?.total ?? 0) >= IP_SHORT_LIMIT) return false

      const longThreshold = new Date(now - IP_LONG_WINDOW_MS).toISOString()
      const [longRow] = await tx
        .select({ total: count() })
        .from(rateEvents)
        .where(
          and(
            eq(rateEvents.eventType, eventType),
            eq(rateEvents.ipAddress, ipAddress),
            gte(rateEvents.createdAt, longThreshold),
          ),
        )
      if ((longRow?.total ?? 0) >= IP_LONG_LIMIT) return false
    }

    await tx.insert(rateEvents).values({ eventType, identifier: sessionId, ipAddress })
    return true
  })
}

/** 清理 24 小时前的过期记录 */
export async function cleanExpiredRateEvents() {
  const threshold = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()
  await db.delete(rateEvents).where(lt(rateEvents.createdAt, threshold))
}
