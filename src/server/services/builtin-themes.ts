import { db } from '@/server/db'
import { themes } from '@/server/db/schema'
import { type BuiltinKey, isBuiltinKey } from '@/shared/builtin-themes'
import { isNotNull } from 'drizzle-orm'

// 类型再导出，方便既有 server-side 调用点继续从本模块取 BuiltinKey
export type { BuiltinKey }

// 内置主题在 seed / instrumentation 时幂等写入，id 一经分配即稳定，且禁止删除，
// 因此懒加载一次后永久驻留内存，无需 TTL 或显式失效。
let cache: Map<number, BuiltinKey> | null = null

async function load(): Promise<Map<number, BuiltinKey>> {
  const rows = await db
    .select({ id: themes.id, builtinKey: themes.builtinKey })
    .from(themes)
    .where(isNotNull(themes.builtinKey))
  const map = new Map<number, BuiltinKey>()
  for (const row of rows) {
    if (isBuiltinKey(row.builtinKey)) {
      map.set(row.id, row.builtinKey)
    }
  }
  return map
}

/**
 * 根据主题 id 取内置 key；非内置主题或 id 不存在时返回 null。
 *
 * 防御性策略：若加载结果为空 Map（例如首次请求早于 ensureBuiltinThemes 完成的极端时序），
 * 不做缓存，下次调用时重新加载。避免静默锁在空状态导致内置主题一律被识别为"自定义"。
 */
export async function getBuiltinKeyById(id: number): Promise<BuiltinKey | null> {
  if (!cache) {
    const loaded = await load()
    if (loaded.size > 0) cache = loaded
    return loaded.get(id) ?? null
  }
  return cache.get(id) ?? null
}

/** 测试用：清空缓存，让下一次查询重新加载 */
export function _resetBuiltinThemeCache() {
  cache = null
}
