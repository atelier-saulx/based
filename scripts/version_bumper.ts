import * as fs from 'fs'
import * as path from 'path'
import * as https from 'https'
import * as crypto from 'crypto'
import * as tar from 'tar'
import { execSync } from 'child_process'

interface PackageJson {
  name: string
  version: string
  private?: boolean
  dependencies?: Record<string, string>
  devDependencies?: Record<string, string>
}

interface WorkspacePackage {
  path: string
  json: PackageJson
}

type ReleaseType = 'alpha' | 'release'
type ChangeType = 'major' | 'minor' | 'patch'

const LOG_PREFIX = '[Version Bumper]'
const WORKSPACE_ROOT = process.cwd() + '/../'
const TEMP_DIR = path.join(WORKSPACE_ROOT, '.tmp-version-bumper')
const SDK_PACKAGE_NAME = 'sdk'

function log(...args: any[]) {
  console.log(LOG_PREFIX, ...args)
}

function exitWithError(...args: any[]): never {
  console.error(LOG_PREFIX, 'ERROR:', ...args)
  process.exit(1)
}

function cleanup() {
  if (fs.existsSync(TEMP_DIR)) {
    log('Cleaning up temporary directory...')
    fs.rmSync(TEMP_DIR, { recursive: true, force: true })
  }
}

function parseArgs() {
  const args = process.argv.slice(2).reduce(
    (acc, arg) => {
      const [key, value] = arg.split('=')
      acc[key.replace('--', '')] = value ?? true
      return acc
    },
    {} as Record<string, any>,
  )

  if (!args.change || !['major', 'minor', 'patch'].includes(args.change)) {
    exitWithError(
      "Mandatory argument '--change' must be one of: major, minor, patch.",
    )
  }
  if (args.all && args.packages) {
    exitWithError("Arguments '--all' and '--packages' are mutually exclusive.")
  }
  if (!args.all && !args.packages) {
    exitWithError(
      "You must provide either '--all' or '--packages=<pkg1>,<pkg2>'.",
    )
  }

  let packageNames = args.packages ? args.packages.split(',') : []
  packageNames.map((pkg) => {
    if (!pkg.includes('@based/')) {
      pkg = '@based/' + pkg
    }
  })

  return {
    releaseType: (args.tag as ReleaseType) || 'release',
    changeType: args.change as ChangeType,
    packageNames: packageNames,
    all: !!args.all,
    force: args.force || args['no-diff'] || false,
  }
}

async function findWorkspacePackages(): Promise<Map<string, WorkspacePackage>> {
  log('Getting workspace packages...')
  const packageMap = new Map<string, WorkspacePackage>()
  const packageDirs = fs.readdirSync(path.join(WORKSPACE_ROOT, 'packages'))

  for (const dir of packageDirs) {
    const packagePath = path.join(WORKSPACE_ROOT, 'packages', dir)
    const packageJsonPath = path.join(packagePath, 'package.json')
    if (fs.existsSync(packageJsonPath)) {
      const json: PackageJson = JSON.parse(
        fs.readFileSync(packageJsonPath, 'utf-8'),
      )
      packageMap.set(json.name, { path: packagePath, json })
    }
  }
  log(`Found ${packageMap.size} packages.`)
  return packageMap
}

async function getNpmPackageInfo(packageName: string): Promise<any> {
  return new Promise((resolve, reject) => {
    https
      .get(`https://registry.npmjs.org/${packageName}`, (res) => {
        if (res.statusCode === 404) return resolve(null)
        if (res.statusCode !== 200)
          return reject(
            new Error(`NPM request failed with status ${res.statusCode}`),
          )
        let data = ''
        res.on('data', (chunk) => (data += chunk))
        res.on('end', () => resolve(JSON.parse(data)))
      })
      .on('error', reject)
  })
}

async function downloadAndUnpack(url: string, dest: string): Promise<void> {
  fs.mkdirSync(dest, { recursive: true })
  return new Promise((resolve, reject) => {
    https
      .get(url, (response) => {
        response
          .pipe(tar.x({ C: dest, strip: 1 }))
          .on('finish', resolve)
          .on('error', reject)
      })
      .on('error', reject)
  })
}

function getAllFiles(dirPath: string, arrayOfFiles: string[] = []): string[] {
  const files = fs.readdirSync(dirPath)

  files.forEach(function (file) {
    const fullPath = path.join(dirPath, file)
    if (fs.statSync(fullPath).isDirectory()) {
      arrayOfFiles = getAllFiles(fullPath, arrayOfFiles)
    } else {
      if (path.basename(fullPath) !== 'package.json') {
        arrayOfFiles.push(fullPath)
      }
    }
  })

  return arrayOfFiles
}

async function compareDirectories(
  dir1: string,
  dir2: string,
): Promise<boolean> {
  const filesList1 = getAllFiles(dir1)
  const filesList2 = getAllFiles(dir2)

  const relativeFiles1 = filesList1.map((f) => path.relative(dir1, f))
  const relativeFiles2 = filesList2.map((f) => path.relative(dir2, f))

  if (relativeFiles1.length !== relativeFiles2.length) {
    log(
      `  - Diff: File count mismatch (${relativeFiles1.length} vs ${relativeFiles2.length}).`,
    )
    return false
  }

  const filesSet1 = new Set(relativeFiles1)
  for (const file2 of relativeFiles2) {
    if (!filesSet1.has(file2)) {
      log(
        `  - Diff: File structure mismatch (e.g., '${file2}' not found locally).`,
      )
      return false
    }
  }

  for (const relativePath of relativeFiles1) {
    const hash1 = crypto
      .createHash('sha256')
      .update(fs.readFileSync(path.join(dir1, relativePath)))
      .digest('hex')
    const hash2 = crypto
      .createHash('sha256')
      .update(fs.readFileSync(path.join(dir2, relativePath)))
      .digest('hex')
    if (hash1 !== hash2) {
      log(`  - Diff: Content of '${relativePath}' has changed.`)
      return false
    }
  }

  return true
}

async function packageHasChanged(
  packageName: string,
  packagePath: string,
  releaseType: ReleaseType,
): Promise<boolean> {
  log(`[${packageName}] Running diff check...`)
  const npmInfo = await getNpmPackageInfo(packageName)
  const npmVersion = npmInfo?.['dist-tags']?.[releaseType]

  if (!npmVersion) {
    log(
      `[${packageName}] No version found on NPM with tag '${releaseType}'. Assuming change.`,
    )
    return true
  }

  log(
    `[${packageName}] Comparing local version against NPM version ${npmVersion} ('${releaseType}' tag).`,
  )
  const tarballUrl = npmInfo.versions[npmVersion]?.dist?.tarball
  if (!tarballUrl) {
    exitWithError(
      `[${packageName}] Could not find tarball URL for version ${npmVersion}.`,
    )
  }

  const localPackDir = path.join(TEMP_DIR, `${packageName}-local-pack`)
  fs.mkdirSync(localPackDir, { recursive: true })
  execSync(`npm pack ${packagePath} --pack-destination=${localPackDir}`, {
    stdio: 'ignore',
  })
  const localTgz = fs.readdirSync(localPackDir)[0]

  const npmUnpackDir = path.join(TEMP_DIR, `${packageName}-npm`)
  await downloadAndUnpack(tarballUrl, npmUnpackDir)

  const localUnpackDir = path.join(TEMP_DIR, `${packageName}-local`)
  fs.mkdirSync(localUnpackDir, { recursive: true })
  await tar.x({
    f: path.join(localPackDir, localTgz),
    C: localUnpackDir,
    strip: 1,
  })

  return !(await compareDirectories(localUnpackDir, npmUnpackDir))
}

function calculateNextVersion(
  currentVersion: string | null,
  changeType: ChangeType,
  releaseType: ReleaseType,
  isPromotion: boolean,
): string {
  if (isPromotion && currentVersion) {
    return currentVersion.split('-')[0] // Promotes 1.2.3-alpha.0 to 1.2.3
  }

  const [major, minor, patch] = (currentVersion || '0.0.0')
    .split('-')[0]
    .split('.')
    .map(Number)
  let nextVersion: string

  switch (changeType) {
    case 'major':
      nextVersion = `${major + 1}.0.0`
      break
    case 'minor':
      nextVersion = `${major}.${minor + 1}.0`
      break
    case 'patch':
      nextVersion = `${major}.${minor}.${patch + 1}`
      break
  }

  if (releaseType === 'alpha') {
    nextVersion += '-alpha.0'
  }

  return nextVersion
}

async function main() {
  const { releaseType, changeType, packageNames, all, force } = parseArgs()
  log(
    `Starting process with config: releaseType=${releaseType}, changeType=${changeType}, force=${force}, all=${all}`,
  )

  cleanup()
  fs.mkdirSync(TEMP_DIR)

  const workspacePackages = await findWorkspacePackages()
  const packagesToProcess = all
    ? Array.from(workspacePackages.keys())
    : packageNames
  const newVersions = new Map<string, string>()

  for (const name of packagesToProcess) {
    if (name === SDK_PACKAGE_NAME) continue
    const pkg = workspacePackages.get(name)
    if (!pkg) {
      log(`Warning: Package '${name}' not found in workspace. Skipping.`)
      continue
    }

    const hasChanged = force
      ? true
      : await packageHasChanged(name, pkg.path, releaseType)
    if (hasChanged) {
      log(`[${name}] Change detected.`)
      const npmInfo = await getNpmPackageInfo(name)
      const alphaVersion = npmInfo?.['dist-tags']?.alpha
      const releaseVersion = npmInfo?.['dist-tags']?.latest

      const isPromotion =
        releaseType === 'release' &&
        !!alphaVersion &&
        alphaVersion.split('-')[0] > (releaseVersion || '0.0.0')
      const baseVersion = isPromotion
        ? alphaVersion
        : releaseType === 'alpha'
          ? alphaVersion
          : releaseVersion

      const nextVersion = calculateNextVersion(
        baseVersion,
        changeType,
        releaseType,
        isPromotion,
      )
      newVersions.set(name, nextVersion)
    } else {
      log(`[${name}] No changes detected.`)
    }
  }

  const sdkPackage = workspacePackages.get(SDK_PACKAGE_NAME)
  if (sdkPackage && newVersions.size > 0) {
    log(`Bumping SDK package: ${sdkPackage.json.name}`)
    const npmInfo = await getNpmPackageInfo(sdkPackage.json.name)
    const baseVersion =
      releaseType === 'alpha'
        ? npmInfo?.['dist-tags']?.alpha
        : npmInfo?.['dist-tags']?.latest
    const nextVersion = calculateNextVersion(
      baseVersion,
      changeType,
      releaseType,
      false,
    )
    newVersions.set(sdkPackage.json.name, nextVersion)
  }

  if (newVersions.size === 0) {
    log('\nNo packages needed a version bump. Exiting.')
    cleanup()
    return
  }

  log('\nApplying version updates...')
  for (const [name, pkg] of workspacePackages.entries()) {
    let wasModified = false
    const newPkgJson = { ...pkg.json }

    if (newVersions.has(name)) {
      log(`  - ${name}: ${pkg.json.version} -> ${newVersions.get(name)}`)
      newPkgJson.version = newVersions.get(name)!
      wasModified = true
    }

    for (const depType of ['dependencies', 'devDependencies'] as const) {
      if (newPkgJson[depType]) {
        for (const depName in newPkgJson[depType]) {
          if (newVersions.has(depName)) {
            const newVersion = newVersions.get(depName)!
            if (newPkgJson[depType]![depName] !== newVersion) {
              newPkgJson[depType]![depName] = newVersion
              wasModified = true
            }
          }
        }
      }
    }

    if (wasModified) {
      fs.writeFileSync(
        path.join(pkg.path, 'package.json'),
        JSON.stringify(newPkgJson, null, 2) + '\n',
      )
    }
  }

  cleanup()
  log('\nProcess complete.')
}

main().catch((err) => exitWithError(err.message, err.stack))
