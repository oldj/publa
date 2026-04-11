import { strToU8, zipSync } from 'fflate'
import { describe, expect, it } from 'vitest'
import {
  MAX_ENTRIES,
  MAX_ENTRY_BYTES,
  MAX_ZIP_BYTES,
  buildZip,
  parseZip,
} from './zip'

describe('buildZip / parseZip 往返', () => {
  it('简单 round-trip，内容完整', () => {
    const buf = buildZip([
      { name: 'foo', content: 'body { color: red; }' },
      { name: 'bar', content: '.a { display: none; }' },
    ])
    const result = parseZip(buf)
    expect(result.skipped).toBe(0)
    expect(result.entries).toHaveLength(2)
    const map = new Map(result.entries.map((e) => [e.name, e.content]))
    expect(map.get('foo')).toBe('body { color: red; }')
    expect(map.get('bar')).toBe('.a { display: none; }')
  })

  it('非法字符被 sanitize', () => {
    const buf = buildZip([{ name: 'a/b:c*d?', content: 'x' }])
    // 文件名已被替换，但 parseZip 会去掉 .css 扩展再返回
    const result = parseZip(buf)
    expect(result.entries).toHaveLength(1)
    // sanitize 后的 name 应不含任何非法字符
    expect(result.entries[0].name).toBe('a_b_c_d_')
  })

  it('同名条目追加 (1)、(2) 后缀', () => {
    const buf = buildZip([
      { name: 'foo', content: 'a' },
      { name: 'foo', content: 'b' },
      { name: 'foo', content: 'c' },
    ])
    const result = parseZip(buf)
    expect(result.entries).toHaveLength(3)
    const names = result.entries.map((e) => e.name).sort()
    expect(names).toEqual(['foo', 'foo (1)', 'foo (2)'])
  })

  it('空名回退 untitled', () => {
    const buf = buildZip([{ name: '   ', content: 'x' }])
    const result = parseZip(buf)
    expect(result.entries).toHaveLength(1)
    expect(result.entries[0].name).toBe('untitled')
  })
})

describe('parseZip 过滤规则', () => {
  it('跳过 __MACOSX 目录与 .DS_Store', () => {
    const buf = zipSync({
      'a.css': strToU8('body {}'),
      '__MACOSX/a.css': strToU8('meta'),
      '.DS_Store': strToU8('meta'),
    })
    const result = parseZip(buf)
    expect(result.entries).toHaveLength(1)
    expect(result.entries[0].name).toBe('a')
    expect(result.skipped).toBe(2)
  })

  it('跳过子目录内的条目', () => {
    const buf = zipSync({
      'root.css': strToU8('x'),
      'sub/child.css': strToU8('y'),
    })
    const result = parseZip(buf)
    expect(result.entries).toHaveLength(1)
    expect(result.entries[0].name).toBe('root')
    expect(result.skipped).toBe(1)
  })

  it('跳过非 .css 文件', () => {
    const buf = zipSync({
      'a.css': strToU8('x'),
      'readme.txt': strToU8('y'),
      'b.CSS': strToU8('z'),
    })
    const result = parseZip(buf)
    expect(result.entries).toHaveLength(2)
    expect(result.skipped).toBe(1)
  })

  it('去掉 UTF-8 BOM', () => {
    const content = '\ufeffbody { color: blue; }'
    const buf = zipSync({ 'withbom.css': strToU8(content) })
    const result = parseZip(buf)
    expect(result.entries).toHaveLength(1)
    expect(result.entries[0].content.charCodeAt(0)).not.toBe(0xfeff)
    expect(result.entries[0].content).toBe('body { color: blue; }')
  })

  it('单条超大被跳过', () => {
    const big = 'a'.repeat(MAX_ENTRY_BYTES + 1)
    const buf = zipSync({
      'small.css': strToU8('ok'),
      'big.css': strToU8(big),
    })
    const result = parseZip(buf)
    expect(result.entries).toHaveLength(1)
    expect(result.entries[0].name).toBe('small')
    expect(result.skipped).toBeGreaterThanOrEqual(1)
  })

  it('条目数超 MAX_ENTRIES 被截断', () => {
    const files: Record<string, Uint8Array> = {}
    for (let i = 0; i < MAX_ENTRIES + 10; i++) {
      files[`f${i}.css`] = strToU8('x')
    }
    const buf = zipSync(files)
    const result = parseZip(buf)
    expect(result.entries).toHaveLength(MAX_ENTRIES)
  })

  it('整包超限抛 ZIP_TOO_LARGE', () => {
    const fake = new Uint8Array(MAX_ZIP_BYTES + 1)
    expect(() => parseZip(fake)).toThrow('ZIP_TOO_LARGE')
  })

  it('损坏的 zip 抛 ZIP_INVALID', () => {
    const junk = new Uint8Array([1, 2, 3, 4, 5])
    expect(() => parseZip(junk)).toThrow('ZIP_INVALID')
  })
})
