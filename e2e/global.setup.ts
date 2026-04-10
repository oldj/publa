import fs from 'fs'
import path from 'path'

async function globalSetup() {
  const tmpDir = path.join(process.cwd(), 'e2e', 'tmp')
  fs.rmSync(tmpDir, { recursive: true, force: true })
  fs.mkdirSync(tmpDir, { recursive: true })
}

export default globalSetup
