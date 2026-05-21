export async function register() {
  // Edge Runtime 不需要数据库迁移
  if (process.env.NEXT_RUNTIME !== 'nodejs') return

  const { runMigrations } = await import('@/server/db')
  await runMigrations()
  console.log('Database migration completed.')

  // 升级现有库时为新增的 setting key 幂等补齐默认值；未初始化的库（首次启动）跳过，
  // 让 setup 流程的 seed() 用用户选择的初始语言写入 settings.language。
  const { isSystemInitialized } = await import('@/server/auth')
  const { ensureBuiltinThemes, ensureSettingsSeeded } = await import('@/server/db/seed')
  if (await isSystemInitialized()) {
    await ensureSettingsSeeded()
  }
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
