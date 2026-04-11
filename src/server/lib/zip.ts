import { strFromU8, strToU8, unzipSync, zipSync } from 'fflate'

// 单个 zip 文件字节数上限（压缩前整包）
export const MAX_ZIP_BYTES = 10 * 1024 * 1024
// 单个条目解压后字节数上限
export const MAX_ENTRY_BYTES = 1 * 1024 * 1024
// 单个 zip 内允许的最大条目数
export const MAX_ENTRIES = 500
// 所有条目累计解压后字节数上限（防 zip bomb）
export const MAX_TOTAL_UNCOMPRESSED = 20 * 1024 * 1024

export interface ZipEntry {
  name: string
  content: string
}

export interface ParsedZipResult {
  entries: ZipEntry[]
  skipped: number
}

/** 替换 Windows/POSIX 不允许的文件名字符，空串回退 untitled */
function sanitizeBaseName(name: string): string {
  // 去掉控制字符与 /\:*?"<>| 等非法字符
  // eslint-disable-next-line no-control-regex
  let s = name.replace(/[\x00-\x1f\x7f/\\:*?"<>|]/g, '_')
  // 去掉前后空白与 .
  s = s.replace(/^[\s.]+|[\s.]+$/g, '')
  if (!s) return 'untitled'
  return s
}

/**
 * 将条目数组打包成扁平 zip（根目录），同名条目追加 ` (1)`、` (2)` 形式的后缀。
 * 文件名始终以 .css 结尾，即便原 name 已含 .css 也**不截断**，以尊重原名。
 */
export function buildZip(entries: ZipEntry[]): Uint8Array {
  const files: Record<string, Uint8Array> = {}
  const used = new Map<string, number>()

  for (const entry of entries) {
    const base = sanitizeBaseName(entry.name)
    const baseFile = `${base}.css`
    let finalName = baseFile
    if (used.has(baseFile)) {
      const n = (used.get(baseFile) ?? 0) + 1
      used.set(baseFile, n)
      finalName = `${base} (${n}).css`
      // 极端情况下 `${base} (n).css` 仍和其他已用名冲突，继续递增
      while (files[finalName] !== undefined) {
        const n2 = (used.get(baseFile) ?? n) + 1
        used.set(baseFile, n2)
        finalName = `${base} (${n2}).css`
      }
    } else {
      used.set(baseFile, 0)
    }
    files[finalName] = strToU8(entry.content)
  }

  return zipSync(files, { level: 6 })
}

/** 解析 zip，仅提取根目录下的 .css 文件，跳过子目录与 macOS/Windows 打包产物 */
export function parseZip(buffer: Uint8Array): ParsedZipResult {
  if (buffer.byteLength > MAX_ZIP_BYTES) {
    throw new Error('ZIP_TOO_LARGE')
  }

  let raw: Record<string, Uint8Array>
  try {
    raw = unzipSync(buffer)
  } catch {
    throw new Error('ZIP_INVALID')
  }

  const entries: ZipEntry[] = []
  let skipped = 0
  let totalBytes = 0

  for (const [path, bytes] of Object.entries(raw)) {
    // 跳过 macOS 打包产物
    if (path.startsWith('__MACOSX/')) {
      skipped++
      continue
    }
    // 跳过子目录内的条目（要求扁平结构）
    if (path.includes('/') || path.includes('\\')) {
      skipped++
      continue
    }
    // 跳过 OS 产生的隐藏文件
    if (path === '.DS_Store' || path === 'Thumbs.db' || path.startsWith('._')) {
      skipped++
      continue
    }
    // 只接受以 .css 结尾（大小写不敏感）
    if (!/\.css$/i.test(path)) {
      skipped++
      continue
    }
    // 单条大小限制
    if (bytes.byteLength > MAX_ENTRY_BYTES) {
      skipped++
      continue
    }
    // 累计大小限制（防 zip bomb）
    totalBytes += bytes.byteLength
    if (totalBytes > MAX_TOTAL_UNCOMPRESSED) {
      throw new Error('ZIP_TOO_LARGE')
    }

    let text = strFromU8(bytes)
    // 去掉 UTF-8 BOM
    if (text.charCodeAt(0) === 0xfeff) {
      text = text.slice(1)
    }

    const name = path.replace(/\.css$/i, '').trim()
    if (!name) {
      skipped++
      continue
    }

    entries.push({ name, content: text })
    if (entries.length >= MAX_ENTRIES) break
  }

  return { entries, skipped }
}
