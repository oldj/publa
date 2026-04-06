import { cleanOldActivityLogs } from '@/server/services/activity-logs'
import { cleanOldEmailLogs } from '@/server/services/email-logs'
import { cleanOrphanRevisions } from '@/server/services/revisions'

/** 每日执行的定时任务 */
export async function runDailyTasks() {
  await cleanOldEmailLogs()
  await cleanOrphanRevisions()
  await cleanOldActivityLogs()
}
