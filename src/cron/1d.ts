import { cleanExpiredCaptchas } from '@/server/lib/captcha'
import { cleanExpiredRateEvents } from '@/server/lib/rate-limit'

/** 每日执行的定时任务 */
export async function runOneMinuteTasks() {
  // 清理过期数据
  await cleanExpiredCaptchas()
  await cleanExpiredRateEvents()
}
