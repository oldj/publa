export async function register() {
  // Edge Runtime 不需要数据库迁移
  if (process.env.NEXT_RUNTIME !== 'nodejs') return

  const { runMigrations } = await import('@/server/db')
  await runMigrations()
  console.log('Database migration completed.')

  // 升级现有库时为新增的 setting key 幂等补齐默认值，避免运行时缺 key 拿到 undefined
  const { ensureBuiltinThemes, ensureSettingsSeeded } = await import('@/server/db/seed')
  await ensureSettingsSeeded()
  await ensureBuiltinThemes()

  // 初始化 JWT secret（环境变量 > 数据库 > 自动生成）
  const { initJwtSecret } = await import('@/server/auth/shared')
  await initJwtSecret()

  // Vercel 使用 vercel.json crons 触发 API 路由，不需要进程内调度
  if (!process.env.VERCEL) {
    const { startScheduler } = await import('@/cron')
    startScheduler()
  }
}
