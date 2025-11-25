import { createRequire } from 'node:module'
import os from 'node:os'
import path from 'node:path'
import process from 'node:process'

const require = createRequire(import.meta.url)
const platform = os.platform()
const arch = os.arch()
const versionMatch = process?.version?.match(/^v?(\d+)/)?.[1] || ''
const nodeMajorVersion = parseInt(versionMatch, 10)

let platformDir

switch (platform) {
  case 'darwin':
    platformDir = arch === 'arm64' ? 'darwin_aarch64' : 'darwin_x86_64'
    break
  case 'linux':
    platformDir = arch === 'arm64' ? 'linux_aarch64' : 'linux_x86_64'
    break
  default:
    throw new Error(`Unsupported platform: ${platform}`)
}

const libPath = path.join(
  '../dist/lib',
  platformDir,
  `libnode-v${nodeMajorVersion}.node`,
)

export default require(libPath)
