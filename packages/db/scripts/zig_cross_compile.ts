import fs from 'fs'
import path from 'path'
import { execSync } from 'child_process'
import axios from 'axios'
import * as tar from 'tar'
import rimraf from 'rimraf'
import { fileURLToPath } from 'url'
import { dirname } from 'path'
import os from 'os'

const args = process.argv.slice(2)
const isRelease = args.includes('release')

const AVAILABLE_PLATFORMS = [
  { os: 'linux', arch: 'aarch64' },
  { os: 'macos', arch: 'aarch64' },
  { os: 'linux', arch: 'x86_64' },
  //   { os: 'macos', arch: 'x86_64' },
]

const AVAILABLE_NODE_VERSIONS = ['v20.11.1', 'v20.18.1', 'v22.13.0']

const PLATFORMS = isRelease
  ? AVAILABLE_PLATFORMS
  : [
      {
        os: os.platform() === 'darwin' ? 'macos' : os.platform(),
        arch: ({ arm64: 'aarch64', aarch64: 'aarch64', x64: 'x86_64', x86_64: 'x86_64' })[os.arch()],
      },
    ]

const NODE_VERSIONS = isRelease ? AVAILABLE_NODE_VERSIONS : [process.version]

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.join(dirname(__filename), '..')

const DEPS_DIR = path.join(__dirname, 'deps')
const DIST_DIR = path.join(__dirname, 'dist', 'lib')

if (!fs.existsSync(DEPS_DIR)) fs.mkdirSync(DEPS_DIR, { recursive: true })
if (!fs.existsSync(DIST_DIR)) fs.mkdirSync(DIST_DIR, { recursive: true })

async function downloadAndExtractNodeHeaders(version: string) {
  const url = `https://nodejs.org/dist/${version}/node-${version}-headers.tar.gz`
  const tarballPath = path.join(DEPS_DIR, `node-${version}-headers.tar.gz`)
  const extractPath = path.join(DEPS_DIR, `node-${version}`)

  if (fs.existsSync(extractPath)) {
    return path.relative(__dirname, extractPath)
  }

  console.log(`Downloading Node.js headers for version ${version}...`)
  const response = await axios.get(url, { responseType: 'arraybuffer' })
  fs.writeFileSync(tarballPath, response.data)

  console.log(`Extracting Node.js headers for version ${version}...`)
  await tar.x({ file: tarballPath, cwd: DEPS_DIR })

  fs.unlinkSync(tarballPath)

  return path.relative(__dirname, extractPath)
}

function buildWithZig(
  target: string,
  nodeHeadersPath: string,
  libSelvaPath: string,
) {
  console.log(`Building for target ${target}...`)
  execSync(
    `zig build -Dtarget=${target} -Dnode_hpath=${nodeHeadersPath}/include/node/ -Dlibselvapath=${libSelvaPath} -Dheadersselvapath=${libSelvaPath}/include`,
    {
      stdio: 'inherit',
    },
  )
}

function moveLibraryToPlatformDir(
  destinationLibPath: string,
  version: string,
): void {
  const originalPath = path.join(__dirname, 'zig-out', 'lib', 'lib.node')
  const newPath = path.join(destinationLibPath, `libnode-${version}.node`)

  if (fs.existsSync(originalPath)) {
    console.log(`Renaming library to ${newPath}...`)
    fs.renameSync(originalPath, newPath)
  } else {
    throw new Error(`Library not found at ${originalPath}`)
  }
}

function getDestinationLibraryPath(platform: {
  os: string
  arch: string
}): string {
  let osName = platform.os === 'macos' ? 'darwin' : platform.os
  let archName = platform.arch

  const platformDir = path.join(DIST_DIR, `${osName}_${archName}`)
  if (!fs.existsSync(platformDir))
    fs.mkdirSync(platformDir, { recursive: true })

  return path.relative(__dirname, platformDir)
}

async function main() {
  for (const platform of PLATFORMS) {
    const target = `${platform.arch}-${platform.os}${platform.os === 'linux' ? '-gnu' : ''}`

    for (const version of NODE_VERSIONS) {
      try {
        const nodeHeadersPath = await downloadAndExtractNodeHeaders(version)
        const destinationLibPath = getDestinationLibraryPath(platform)

        buildWithZig(target, nodeHeadersPath, destinationLibPath)
        moveLibraryToPlatformDir(destinationLibPath, version)

        console.log('Cleaning up zig-out directory...')
        rimraf.sync(path.join(__dirname, 'zig-out'))
      } catch (error) {
        console.error(
          `Error processing version ${version} for platform ${target}:`,
          error,
        )
        throw error
      }
    }
  }
}

main().catch((err) => {
  console.error('Error in cross-compiling zig:', err)
  process.exit(1)
})
