import fs from 'fs'
import path from 'path'
import { execSync } from 'child_process'
import * as tar from 'tar'
import { fileURLToPath } from 'url'
import { dirname } from 'path'
import os from 'os'

const AVAILABLE_PLATFORMS = [
  { os: 'linux', arch: 'aarch64' },
  { os: 'macos', arch: 'aarch64' },
  { os: 'linux', arch: 'x86_64' },
  //   { os: 'macos', arch: 'x86_64' },
]
const ARGS_PLATFORMS = {}
AVAILABLE_PLATFORMS.forEach((v) => (ARGS_PLATFORMS[`${v.os}-${v.arch}`] = v))

const args = process.argv.slice(2)
const isRelease = args.includes('release')
const isDebugging = args.includes('debug')
const argsArchs = args.map((arg) => ARGS_PLATFORMS[arg]).filter((v) => v) // Throw an error for invalid arch

let debugOption = ''
if (isDebugging) {
  debugOption = '-Denable_debug=true'
}

type Platform = { os: string; arch: string }

async function fetchAvailableNodeVersions(): Promise<Map<string, string>> {
  const response = await fetch('https://nodejs.org/dist/index.json')
  if (!response.ok) {
    throw new Error(`HTTP error! status: ${response.status}`)
  }
  const data = await response.json()

  const versions = new Map()
  for (const release of data) {
    const [_, major, minor, patch] =
      release.version.match(/^v(\d+)\.(\d+)\.(\d+)/) || []
    if (major && !versions.has(major) && major >= 22) {
      versions.set(major, `v${major}.${minor}.${patch}`)
    }
  }
  return versions
}

const PLATFORMS = isRelease
  ? AVAILABLE_PLATFORMS
  : argsArchs.length
    ? argsArchs
    : [
        {
          os: os.platform() === 'darwin' ? 'macos' : os.platform(),
          arch: {
            arm64: 'aarch64',
            aarch64: 'aarch64',
            x64: 'x86_64',
            x86_64: 'x86_64',
          }[os.arch() as 'arm64' | 'aarch64' | 'x64' | 'x86_64'],
        },
      ]

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
  const response = await fetch(url)
  if (!response.ok) {
    throw new Error(`HTTP error! status: ${response.status}`)
  }
  const arrayBuffer = await response.arrayBuffer()
  const buffer = Buffer.from(arrayBuffer)
  fs.writeFileSync(tarballPath, buffer)

  console.log(`Extracting Node.js headers for version ${version}...`)
  await tar.x({ file: tarballPath, cwd: DEPS_DIR })

  fs.unlinkSync(tarballPath)

  return path.relative(__dirname, extractPath)
}

function buildWithZig(
  target: string,
  nodeHeadersPath: string,
  rpath: string,
  libSelvaPath: string,
) {
  console.log(`Building for target ${target}...`)
  const buildCommand = `zig build ${debugOption} -Dtarget=${target} -Dnode_hpath=${nodeHeadersPath}/include/node/ '-Drpath=${rpath}' -Dlibselvapath=${libSelvaPath} -Dheadersselvapath=${libSelvaPath}/include`
  execSync(buildCommand, {
    stdio: 'inherit',
  })
}

function moveLibraryToPlatformDir(
  destinationLibPath: string,
  major: string,
  platform: Platform,
): void {
  const originalPath = path.join(__dirname, 'zig-out', 'lib', 'lib.node')
  const newPath = path.join(destinationLibPath, `libnode-${major}.node`)

  if (fs.existsSync(originalPath)) {
    console.log(`Renaming library to ${newPath}...`)
    fs.renameSync(originalPath, newPath)
    if (isDebugging && platform.os === 'macos') {
      const dyCmd = `/bin/bash -c "rm -rf ${destinationLibPath}/libbased_db_zig.dylib.dSYM && mv ${__dirname}/zig-out/lib/libbased_db_zig.dylib*.* ${destinationLibPath}/"`
      execSync(dyCmd, {
        stdio: 'inherit',
      })
    }

    if (platform.os === 'linux') {
      if (os.platform() == 'darwin') {
        const cmd = `/bin/bash -c "cd /usr/src/based-db/packages/db/dist/lib/linux_${platform.arch}/ && ../../../scripts/patch_libnode.sh ${major}"`
        execSync(
          `podman run --rm -v "$PWD/../..:/usr/src/based-db" based-db-clibs-build-linux_${platform.arch} ${cmd}`,
          {
            stdio: 'inherit',
          },
        )
      } else {
        const cmd = `/bin/bash -c "cd dist/lib/linux_${platform.arch}/ && ../../../scripts/patch_libnode.sh ${major}"`
        try {
          execSync(cmd, {
            stdio: 'inherit',
          })
        } catch (error: any) {
          console.warn(
            `Warning: Failed to patch library with patchelf: ${error.message}`,
          )
          throw error
        }
      }
    }
  } else {
    throw new Error(`Library not found at ${originalPath}`)
  }
}

function getDestinationLibraryPath(platform: Platform): string {
  let osName = platform.os === 'macos' ? 'darwin' : platform.os
  let archName = platform.arch

  const platformDir = path.join(DIST_DIR, `${osName}_${archName}`)
  if (!fs.existsSync(platformDir))
    fs.mkdirSync(platformDir, { recursive: true })

  return path.relative(__dirname, platformDir)
}

async function main() {
  const NODE_VERSIONS = isRelease
    ? Array.from((await fetchAvailableNodeVersions()).entries())
    : [[process.version.match(/^v(\d+)\./)?.[1] ?? '20', process.version]]

  for (const platform of PLATFORMS) {
    const target = `${platform.arch}-${platform.os}${platform.os === 'linux' ? '-gnu' : ''}`
    const rpath = platform.os == 'macos' ? '@loader_path' : '$ORIGIN'

    for (const [major, version] of NODE_VERSIONS) {
      try {
        const nodeHeadersPath = await downloadAndExtractNodeHeaders(version)
        const destinationLibPath = getDestinationLibraryPath(platform)

        buildWithZig(target, nodeHeadersPath, rpath, destinationLibPath)
        moveLibraryToPlatformDir(destinationLibPath, 'v' + major, platform)

        console.log('Cleaning up zig-out directory...')
        execSync(`rm -rf ${path.join(__dirname, 'zig-out')}`)
      } catch (error) {
        console.error(
          `Error processing version v${major} for platform ${target}:`,
          error,
        )
        throw error
      }
    }
  }
  console.log('Done Zig building!')
}

main().catch((err) => {
  console.error('Error in cross-compiling zig:', err)
  process.exit(1)
})
