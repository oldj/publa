/**
 * 递增版本号并同步到 package.json。
 *
 * 用法:
 *   node scripts/up-version.mjs          # patch: 0.1.0 → 0.1.1
 *   node scripts/up-version.mjs patch    # 同上
 *   node scripts/up-version.mjs minor    # minor: 0.1.3 → 0.2.0
 *   node scripts/up-version.mjs major    # major: 0.1.3 → 1.0.0
 */

import { execSync } from 'node:child_process'
import { readFileSync, writeFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const root = resolve(__dirname, '..')

const level = process.argv[2] || 'patch'
if (!['major', 'minor', 'patch'].includes(level)) {
  console.error(`无效参数: ${level}，可选值: major | minor | patch`)
  process.exit(1)
}

// 读取并递增版本号
const versionPath = resolve(root, 'src/version.json')
const ver = JSON.parse(readFileSync(versionPath, 'utf-8'))

if (level === 'major') {
  ver[0] += 1
  ver[1] = 0
  ver[2] = 0
} else if (level === 'minor') {
  ver[1] += 1
  ver[2] = 0
} else {
  ver[2] += 1
}

const versionStr = ver.join('.')

// 写回 version.json
writeFileSync(versionPath, JSON.stringify(ver) + '\n', 'utf-8')

// 同步到 package.json
const pkgPath = resolve(root, 'package.json')
const pkg = JSON.parse(readFileSync(pkgPath, 'utf-8'))
pkg.version = versionStr
writeFileSync(pkgPath, JSON.stringify(pkg, null, 2) + '\n', 'utf-8')

// 自动提交版本变更
execSync(`git add src/version.json package.json`, { cwd: root })
execSync(`git commit -m "chore: bump version to ${versionStr}"`, { cwd: root })
execSync(`git tag release-v${versionStr}`, { cwd: root })

console.log(`版本号已更新: v${versionStr}`)
console.log(`已添加 git tag: release-v${versionStr}`)
