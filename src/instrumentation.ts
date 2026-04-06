export async function register() {
  // Edge Runtime 不需要数据库迁移
  if (process.env.NEXT_RUNTIME !== 'nodejs') return

  const { dbReady, runMigrations } = await import('@/server/db')
  await dbReady
  await runMigrations()
  console.log('Database migration completed.')

  // 初始化 JWT secret（环境变量 > 数据库 > 自动生成）
  const { initJwtSecret } = await import('@/server/auth/shared')
  await initJwtSecret()

  // Vercel 使用 vercel.json crons 触发 API 路由，不需要进程内调度
  if (!process.env.VERCEL) {
    const { startScheduler } = await import('@/cron')
    startScheduler()
  }
}
