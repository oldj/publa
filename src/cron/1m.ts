import { cleanExpiredCaptchas } from '@/server/lib/captcha'
import { cleanExpiredRateEvents } from '@/server/lib/rate-limit'
import { publishScheduledPages } from '@/server/services/pages'
import { publishScheduledPosts } from '@/server/services/posts'

/** 每分钟执行的定时任务 */
export async function runOneMinuteTasks() {
  // 定时发布
  await publishScheduledPosts()
  await publishScheduledPages()

  // 清理过期数据
  await cleanExpiredCaptchas()
  await cleanExpiredRateEvents()
}
