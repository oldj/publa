/**
 * 内置主题 key 的单一真相源。
 *
 * 文件零运行时依赖，server 与 client 都可以 import：
 * - 前台布局、/themes/[file] handler、seed、服务层用来约束类型
 * - PreviewStyles（客户端组件）用来做 payload.theme 的白名单校验
 *
 * 新增一个内置主题（比如 'blue'）的改动就集中在这里：
 * 1. 把 'blue' 加入下面的 BUILTIN_KEYS 元组
 * 2. seed.ts 里加一条 ensureBuiltinThemes 的默认项
 * 3. public/themes/blue.css 放入文件
 * 其他文件（handler/PreviewStyles/测试）**不需要改动**。
 */

export const BUILTIN_KEYS = ['light', 'dark', 'blank'] as const

export type BuiltinKey = (typeof BUILTIN_KEYS)[number]

export function isBuiltinKey(v: unknown): v is BuiltinKey {
  return typeof v === 'string' && (BUILTIN_KEYS as readonly string[]).includes(v)
}
