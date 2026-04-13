/**
 * npm version 钩子脚本：将 package.json 的版本号同步到 src/version.json。
 *
 * 由 package.json 的 "version" 生命周期脚本自动调用，
 * 在 npm version 修改 package.json 之后、git commit 之前执行。
 */

import { readFileSync, writeFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const root = resolve(__dirname, '..')

const pkg = JSON.parse(readFileSync(resolve(root, 'package.json'), 'utf-8'))
const ver = pkg.version.split('.').map(Number)
writeFileSync(resolve(root, 'src/version.json'), JSON.stringify(ver) + '\n', 'utf-8')
