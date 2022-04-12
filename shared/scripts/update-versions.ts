/* eslint-disable no-console */
import path from 'path'
import fs from 'fs-extra'
import { cwd } from 'process'
import { PackageData } from './get-package-data'
import { getIncrementedVersion } from 'utilities'

// @ts-ignore
import packageJson from '../../package.json'

async function writeVersionToPackageJson({
  filePath,
  version,
}: {
  filePath: string
  version: string
}) {
  const packageJSONPath = path.join(filePath, '/package.json')
  const packageJson = await fs.readJSON(packageJSONPath)

  packageJson.version = version

  await fs.writeJSON(packageJSONPath, packageJson, { spaces: 2 })
}

async function writeVersionToModulesInFolder(
  inputFolder: string,
  version: string
) {
  const sourceFolder = path.join(cwd(), inputFolder)

  const targetFolders = (await fs.readdir(sourceFolder)).filter((folder) => {
    return fs.pathExistsSync(path.join(sourceFolder, folder, '/package.json'))
  })

  await Promise.all(
    targetFolders.map((folder) => {
      return writeVersionToPackageJson({
        filePath: path.join(sourceFolder, folder),
        version,
      })
    })
  )
}

export async function updatePackageVersionsInRepository({
  version,
  targetFolders: folders,
}: {
  version: string
  targetFolders: string[]
}) {
  /**
   * Update package version in target folders
   */
  const writeVersionsPromises: Promise<void>[] = []

  folders.forEach((folder) => {
    const writeVersionToFolderPromise = writeVersionToModulesInFolder(
      folder,
      version
    )

    writeVersionsPromises.push(writeVersionToFolderPromise)
  })

  await Promise.all(writeVersionsPromises)

  /**
   * Always update root package version
   */
  await writeVersionToPackageJson({
    filePath: path.join(cwd()),
    version,
  })
}

export async function updateTargetPackageVersion({
  packageData,
  version,
}: {
  packageData: PackageData | undefined
  version: string
}) {
  if (!packageData) {
    throw new Error("Can't update package version, package data is undefined")
  }

  /**
   * Update target package version
   */
  await writeVersionToPackageJson({
    filePath: packageData.path,
    version,
  })

  /**
   * Always bump root package version with patch
   */
  const repoVersion = getIncrementedVersion({
    version: packageJson.version,
    type: 'patch',
  })

  await writeVersionToPackageJson({
    filePath: path.join(cwd()),
    version: repoVersion,
  })
}
