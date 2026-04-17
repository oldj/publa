'use client'

/**
 * 编辑器本地草稿备份 hook
 *
 * 每 intervalMs 毫秒把当前编辑快照写入 localStorage，作为云端自动保存失败时的兜底恢复点。
 * 不替代云端草稿，仅用于恢复。恢复提示逻辑由调用方根据 readBackup 返回结果自行决定。
 */

import { useCallback, useEffect, useRef } from 'react'
import type { ContentType } from '@/components/editors/content-convert'

export type LocalDraftEntityType = 'post' | 'page'

const STORAGE_KEY_PREFIX = 'publa:draft-backup:'
const SCHEMA_VERSION = 1 as const
const DEFAULT_INTERVAL_MS = 5_000
const TTL_MS = 14 * 24 * 60 * 60 * 1000
const MAX_ENTRIES = 20
const MAX_SINGLE_SIZE = 2 * 1024 * 1024

export interface LocalDraftBackupContent {
  contentType: ContentType
  contentRaw: string
  contentHtml?: string
}

export interface LocalDraftBackup<F> {
  type: LocalDraftEntityType
  id: number
  savedAt: number
  form: F
  content: LocalDraftBackupContent
  schemaVersion: typeof SCHEMA_VERSION
}

export interface UseLocalDraftBackupOptions<F> {
  type: LocalDraftEntityType
  id: number | null
  /** 返回当前要备份的快照；返回 null 表示本次 tick 跳过（加载中或等待用户确认恢复时） */
  getSnapshot: () => { form: F; content: LocalDraftBackupContent } | null
  intervalMs?: number
}

function storageKey(type: LocalDraftEntityType, id: number) {
  return `${STORAGE_KEY_PREFIX}${type}:${id}`
}

function safeGetStorage(): Storage | null {
  if (typeof window === 'undefined') return null
  try {
    return window.localStorage
  } catch {
    return null
  }
}

/** 清理过期和超额的备份条目。解析失败的条目一并移除。 */
function sweepStorage(storage: Storage, now = Date.now()): void {
  const entries: Array<{ key: string; savedAt: number }> = []
  for (let i = 0; i < storage.length; i++) {
    const key = storage.key(i)
    if (!key || !key.startsWith(STORAGE_KEY_PREFIX)) continue
    const raw = storage.getItem(key)
    if (!raw) continue
    let savedAt = 0
    try {
      const parsed = JSON.parse(raw) as { savedAt?: unknown }
      if (typeof parsed.savedAt === 'number') savedAt = parsed.savedAt
    } catch {
      // 解析失败：视为最旧条目参与下面的清理
    }
    entries.push({ key, savedAt })
  }

  const expiredCutoff = now - TTL_MS
  const kept: Array<{ key: string; savedAt: number }> = []
  for (const e of entries) {
    if (e.savedAt < expiredCutoff) {
      storage.removeItem(e.key)
    } else {
      kept.push(e)
    }
  }

  if (kept.length > MAX_ENTRIES) {
    kept.sort((a, b) => a.savedAt - b.savedAt)
    const excess = kept.length - MAX_ENTRIES
    for (let i = 0; i < excess; i++) {
      storage.removeItem(kept[i].key)
    }
  }
}

export function useLocalDraftBackup<F>(opts: UseLocalDraftBackupOptions<F>): {
  readBackup: () => LocalDraftBackup<F> | null
  discardBackup: () => void
} {
  const { type, id, getSnapshot, intervalMs = DEFAULT_INTERVAL_MS } = opts

  const lastSerializedRef = useRef<string>('')
  const getSnapshotRef = useRef(getSnapshot)
  useEffect(() => {
    getSnapshotRef.current = getSnapshot
  })

  // 首次挂载：清理过期和超额条目
  useEffect(() => {
    const storage = safeGetStorage()
    if (!storage) return
    try {
      sweepStorage(storage)
    } catch {
      // 忽略清理过程中的异常
    }
  }, [])

  // 写入定时器：每 intervalMs 检查一次快照是否变化，变化则写入 localStorage
  useEffect(() => {
    if (id == null) return
    const storage = safeGetStorage()
    if (!storage) return

    const key = storageKey(type, id)
    lastSerializedRef.current = ''

    const write = () => {
      const snapshot = getSnapshotRef.current()
      if (!snapshot) return

      const comparable = JSON.stringify({ form: snapshot.form, content: snapshot.content })
      if (comparable === lastSerializedRef.current) return

      const payload: LocalDraftBackup<F> = {
        type,
        id,
        savedAt: Date.now(),
        form: snapshot.form,
        content: snapshot.content,
        schemaVersion: SCHEMA_VERSION,
      }
      let serialized: string
      try {
        serialized = JSON.stringify(payload)
      } catch {
        return
      }
      if (serialized.length > MAX_SINGLE_SIZE) return

      try {
        storage.setItem(key, serialized)
        lastSerializedRef.current = comparable
      } catch {
        // QuotaExceeded 等异常：清理一次后再试一次
        try {
          sweepStorage(storage)
          storage.setItem(key, serialized)
          lastSerializedRef.current = comparable
        } catch {
          // 仍失败则放弃本次写入，不阻塞编辑
        }
      }
    }

    const timer = setInterval(write, intervalMs)
    return () => {
      clearInterval(timer)
    }
  }, [type, id, intervalMs])

  const readBackup = useCallback((): LocalDraftBackup<F> | null => {
    if (id == null) return null
    const storage = safeGetStorage()
    if (!storage) return null
    const key = storageKey(type, id)
    const raw = storage.getItem(key)
    if (!raw) return null
    try {
      const parsed = JSON.parse(raw) as LocalDraftBackup<F>
      if (
        !parsed ||
        parsed.schemaVersion !== SCHEMA_VERSION ||
        parsed.type !== type ||
        parsed.id !== id ||
        typeof parsed.savedAt !== 'number'
      ) {
        storage.removeItem(key)
        return null
      }
      return parsed
    } catch {
      try {
        storage.removeItem(key)
      } catch {
        // 忽略
      }
      return null
    }
  }, [type, id])

  const discardBackup = useCallback(() => {
    if (id == null) return
    const storage = safeGetStorage()
    if (!storage) return
    try {
      storage.removeItem(storageKey(type, id))
    } catch {
      // 忽略
    }
    // 不重置 lastSerializedRef：若此时 comparable 仍等于上次写入的 hash，
    // 说明当前状态已通过云端同步，下一次 tick 无须重写同样内容到本地。
    // 只有当状态真的变化（hash 不同）时下一次 tick 才会重新写入备份。
  }, [type, id])

  return { readBackup, discardBackup }
}
