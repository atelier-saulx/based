/* eslint-disable no-console */
import path from 'path'
import fs from 'fs-extra'
import { cwd } from 'process'
import { getAllPackages, PackageData } from './get-package-data'

async function writeVersionToPackageJson({
  filePath,
  version,
}: {
  filePath: string
  version: string
}) {
  const packageJson = await fs.readJSON(filePath)
  const packagesInProject = await getAllPackages()

  const packageNamesInProject = packagesInProject.map(
    (packageData) => packageData.name
  )

  /**
   * Match packages in peerDependencies, update version
   */
  if (packageJson.peerDependencies) {
    Object.keys(packageJson.peerDependencies).forEach((packageName) => {
      const isPackageInRepo = packageNamesInProject.includes(packageName)

      if (isPackageInRepo) {
        packageJson.peerDependencies[packageName] = `^${version}`
      }
    })
  }

  /**
   * Match packages in dependencies, update version
   */
  if (packageJson.dependencies) {
    Object.keys(packageJson.dependencies).forEach((packageName) => {
      const isPackageInRepo = packageNamesInProject.includes(packageName)

      if (isPackageInRepo) {
        packageJson.dependencies[packageName] = version
      }
    })
  }

  packageJson.version = version

  await fs.writeJSON(filePath, packageJson, { spaces: 2 })
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
        filePath: path.join(sourceFolder, folder, '/package.json'),
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
   * Update root package version
   */
  await writeVersionToPackageJson({
    filePath: path.join(cwd(), './package.json'),
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

  const { name, path } = packageData

  console.log('>>>>>> updateTargetPackageVersion: ', { name, path, version })

  await writeVersionToPackageJson({
    filePath: path,
    version,
  })
}
