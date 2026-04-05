import { cleanOldEmailLogs } from '@/server/services/email-logs'

/** 每日执行的定时任务 */
export async function runDailyTasks() {
  await cleanOldEmailLogs()
}
