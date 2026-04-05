import { AsyncTask, SimpleIntervalJob, ToadScheduler } from 'toad-scheduler'
import { runOneMinuteTasks } from './1m'

const scheduler = new ToadScheduler()

export function startScheduler() {
  const task = new AsyncTask('1m-cron', async () => {
    try {
      await runOneMinuteTasks()
    } catch (error) {
      console.error('[cron] 1m task failed:', error)
    }
  })

  const job = new SimpleIntervalJob(
    { minutes: 1, runImmediately: true },
    task,
    { id: '1m-cron' },
  )

  scheduler.addSimpleIntervalJob(job)
  console.log('[cron] Scheduler started. 1m task registered.')
}

export { scheduler }
