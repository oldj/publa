/**
 * 自动保存状态机 hook
 *
 * 管理自动保存的间隔策略和失败警告：
 * - normal：30s 间隔，无失败
 * - failing：5s 间隔，1-9 次连续失败（≥3 次时弹出警告）
 * - throttled：30s 间隔，≥10 次连续失败，降低频率减压
 */

import { useCallback, useRef } from 'react'
import { notifications } from '@mantine/notifications'
import { notify } from '@/lib/notify'

export type AutoSavePhase = 'normal' | 'failing' | 'throttled'

export const AUTO_SAVE_INTERVAL: Record<AutoSavePhase, number> = {
  normal: 30_000,
  failing: 5_000,
  throttled: 30_000,
}

const FAIL_THRESHOLD_WARNING = 3
const FAIL_THRESHOLD_THROTTLE = 10

interface UseAutoSavePhaseOptions {
  /** 通知 ID，用于更新和隐藏同一条通知 */
  notificationId: string
  /** 失败警告文案 */
  failMessage: string
}

export function useAutoSavePhase({ notificationId, failMessage }: UseAutoSavePhaseOptions) {
  const autoSavePhaseRef = useRef<AutoSavePhase>('normal')
  const totalConsecutiveFailsRef = useRef(0)
  const failsSinceDismissRef = useRef(0)
  const warningVisibleRef = useRef(false)
  const hidingBySuccessRef = useRef(false)

  const onAutoSaveFail = useCallback(() => {
    totalConsecutiveFailsRef.current += 1
    failsSinceDismissRef.current += 1

    // 状态转换
    const fails = totalConsecutiveFailsRef.current
    if (fails >= FAIL_THRESHOLD_THROTTLE) {
      autoSavePhaseRef.current = 'throttled'
    } else {
      autoSavePhaseRef.current = 'failing'
    }

    // 警告（独立于 phase）
    if (failsSinceDismissRef.current >= FAIL_THRESHOLD_WARNING && !warningVisibleRef.current) {
      warningVisibleRef.current = true
      notify({
        id: notificationId,
        color: 'red',
        message: failMessage,
        autoClose: false,
        onClose: () => {
          if (hidingBySuccessRef.current) {
            hidingBySuccessRef.current = false
          } else {
            // 手动关闭：重置 dismiss 计数器，下次 3 连败再弹
            failsSinceDismissRef.current = 0
          }
          warningVisibleRef.current = false
        },
      })
    }
  }, [notificationId, failMessage])

  const clearAutoSaveFail = useCallback(() => {
    autoSavePhaseRef.current = 'normal'
    totalConsecutiveFailsRef.current = 0
    failsSinceDismissRef.current = 0
    if (warningVisibleRef.current) {
      hidingBySuccessRef.current = true
      notifications.hide(notificationId)
    }
  }, [notificationId])

  return { autoSavePhaseRef, onAutoSaveFail, clearAutoSaveFail }
}
