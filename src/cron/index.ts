import { AsyncTask, SimpleIntervalJob, ToadScheduler } from 'toad-scheduler'
import { runDailyTasks } from './1d'
import { runOneMinuteTasks } from './1m'

const scheduler = new ToadScheduler()

export function startScheduler() {
  const minuteTask = new AsyncTask('1m-cron', async () => {
    try {
      await runOneMinuteTasks()
    } catch (error) {
      console.error('[cron] 1m task failed:', error)
    }
  })

  const minuteJob = new SimpleIntervalJob({ minutes: 1, runImmediately: true }, minuteTask, {
    id: '1m-cron',
  })

  const dailyTask = new AsyncTask('1d-cron', async () => {
    try {
      await runDailyTasks()
    } catch (error) {
      console.error('[cron] 1d task failed:', error)
    }
  })

  const dailyJob = new SimpleIntervalJob({ hours: 24, runImmediately: true }, dailyTask, {
    id: '1d-cron',
  })

  scheduler.addSimpleIntervalJob(minuteJob)
  scheduler.addSimpleIntervalJob(dailyJob)
  console.log('[cron] Scheduler started. 1m and 1d tasks registered.')
}

export { scheduler }
