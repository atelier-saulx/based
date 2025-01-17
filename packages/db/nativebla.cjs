const os = require('os')
const path = require('path')
const process = require('process')

const platform = os.platform()
const arch = os.arch()
const nodeVersion = process.version

const baseDir = path.join(__dirname, 'dist/lib')
let platformDir

switch (platform) {
  case 'darwin':
    platformDir = arch === 'arm64' ? 'darwin_arm64' : 'darwin_x86_64'
    break
  case 'linux':
    platformDir = arch === 'arm64' ? 'linux_aarch64' : 'linux_x86_64'
    break
  default:
    throw new Error(`Unsupported platform: ${platform}`)
}

const libPath = path.join(baseDir, platformDir, `lib.node-${nodeVersion}`)
const addon = require(libPath)

module.exports = addon
