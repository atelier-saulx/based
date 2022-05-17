/* eslint-disable no-console */
import path from 'path'
import fs from 'fs-extra'
import { cwd } from 'process'
import semver from 'semver'
import { getAllPackages, PackageData } from './get-package-data'
import { getIncrementedVersion } from './utilities'

// @ts-ignore
import packageJson from '../../package.json'

async function writeVersionToPackageJson({
  filePath,
  targetVersion,
}: {
  filePath: string
  targetVersion: string
}) {
  const packageJSONPath = path.join(filePath, '/package.json')
  const packageJson = await fs.readJSON(packageJSONPath)

  packageJson.version = targetVersion

  await fs.writeJSON(packageJSONPath, packageJson, { spaces: 2 })
}

async function writeVersionToModulesInFolder(
  inputFolder: string,
  targetVersion: string
) {
  const sourceFolder = path.join(cwd(), inputFolder)

  const targetFolders = (await fs.readdir(sourceFolder)).filter((folder) => {
    return fs.pathExistsSync(path.join(sourceFolder, folder, '/package.json'))
  })

  await Promise.all(
    targetFolders.map((folder) => {
      return writeVersionToPackageJson({
        filePath: path.join(sourceFolder, folder),
        targetVersion,
      })
    })
  )
}

export async function validateSemver({
  targetVersion,
}: {
  targetVersion: string
}) {
  const allPackages = await getAllPackages()

  allPackages.forEach((packageData) => {
    const isValid = semver.lte(packageData.version, targetVersion)
    if (!isValid) {
      throw new Error(
        `Package ${packageData?.name} version ${packageData?.version} is higher than ${targetVersion}.`
      )
    }

    return isValid
  })
}

export async function updatePackageVersionsInRepository({
  targetVersion,
  targetFolders,
}: {
  targetVersion: string
  targetFolders: string[]
}) {
  /**
   * Ensure no repository version is higher than the target version.
   */
  await validateSemver({ targetVersion })

  /**
   * Update package version in target folders
   */
  const writeVersionsPromises: Promise<void>[] = []

  targetFolders.forEach((folder) => {
    const writeVersionToFolderPromise = writeVersionToModulesInFolder(
      folder,
      targetVersion
    )

    writeVersionsPromises.push(writeVersionToFolderPromise)
  })

  await Promise.all(writeVersionsPromises)

  /**
   * Always update root package version
   */
  await writeVersionToPackageJson({
    filePath: path.join(cwd()),
    targetVersion,
  })
}

export async function updateTargetPackageVersion({
  packageData,
  targetVersion,
}: {
  packageData: PackageData | undefined
  targetVersion: string
}) {
  if (!packageData) {
    throw new Error("Can't update package version, package data is undefined")
  }

  /**
   * Update target package version
   */
  await writeVersionToPackageJson({
    filePath: packageData.path,
    targetVersion,
  })
}

export async function patchRepositoryVersion() {
  /**
   * Bump root package version with patch
   */
  const repoVersion = getIncrementedVersion({
    version: packageJson.version,
    type: 'patch',
  })

  await writeVersionToPackageJson({
    filePath: path.join(cwd()),
    targetVersion: repoVersion,
  })
}

export async function updateDependenciesOfPackage({
  targetPackage,
  outdatedDependency,
}: {
  targetPackage: PackageData
  outdatedDependency: PackageData
}) {
  const packageJSONPath = path.join(outdatedDependency.path, '/package.json')
  const packageJson = await fs.readJSON(packageJSONPath)
  const versionString = `${targetPackage.version}`

  if (packageJson.devDependencies) {
    Object.keys(packageJson.devDependencies).forEach((packageName) => {
      const isPackageInRepo = [targetPackage.name].includes(packageName)

      if (isPackageInRepo) {
        packageJson.devDependencies[packageName] = versionString
      }
    })
  }

  if (packageJson.dependencies) {
    Object.keys(packageJson.dependencies).forEach((packageName) => {
      const isPackageInRepo = [targetPackage.name].includes(packageName)

      if (isPackageInRepo) {
        packageJson.dependencies[packageName] = versionString
      }
    })
  }

  await fs.writeJSON(packageJSONPath, packageJson, { spaces: 2 })
}
