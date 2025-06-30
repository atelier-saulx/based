const os = require('os')
const path = require('path')
const process = require('process')

const platform = os.platform()
const arch = os.arch()
const nodeMajorVersion = parseInt(process.version.match(/^v?(\d+)/)[1], 10)

const baseDir = path.join(__dirname, 'dist/lib')
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
  baseDir,
  platformDir,
  `libnode-v${nodeMajorVersion}.node`,
)
const addon = require(libPath)

module.exports = addon
