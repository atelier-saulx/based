import path from 'path'
import fs from 'fs-extra'
import { cwd } from 'process'

import { getWorkspaceFolders } from './utilities'

interface PackageJSON {
  [key: string]: any
}

export interface PackageData {
  name: string
  path: string
  version: string
  packageJSON: PackageJSON
  private?: boolean
}

async function getPackageName({
  targetPath,
}: {
  targetPath: string
}): Promise<PackageData> {
  const packageJSONPath = path.join(targetPath, '/package.json')
  const packageJSON = await fs.readJSON(packageJSONPath)

  return {
    name: packageJSON.name,
    version: packageJSON.version,
    path: targetPath,
    private: packageJSON.private ?? false,
    packageJSON,
  }
}

async function getPackageNamesInFolder({
  targetFolder,
}: {
  targetFolder: string
}): Promise<PackageData[]> {
  const sourceFolder = path.join(cwd(), targetFolder)

  const targetFolders = (await fs.readdir(sourceFolder)).filter((folder) => {
    return fs.pathExistsSync(path.join(sourceFolder, folder, '/package.json'))
  })

  const packageNames = await Promise.all(
    targetFolders.map((folder) =>
      getPackageName({
        targetPath: path.join(sourceFolder, folder),
      })
    )
  )

  return packageNames
}

/**
 * Get all packages in repository
 */
export async function getAllPackages(): Promise<PackageData[]> {
  let allPackageNames: PackageData[] = []

  /**
   * Get all workspace folders. Filter out `/*`
   */
  const workspaceFolders = await getWorkspaceFolders()

  /**
   * Get all package names in workspace folders
   */
  const packageNamesPerFolderPromises = workspaceFolders.map((targetFolder) => {
    return getPackageNamesInFolder({
      targetFolder,
    })
  })

  /**
   * Merge package-names into one array
   */
  const packageNamesPerFolder = await Promise.all(packageNamesPerFolderPromises)

  packageNamesPerFolder.forEach((packageNames) => {
    allPackageNames = [...allPackageNames, ...packageNames]
  })

  return allPackageNames
}

/**
 * Get public packages in repository
 */
export async function getPublicPackages(): Promise<PackageData[]> {
  const allPackages: PackageData[] = await getAllPackages()

  return allPackages.filter((packageData) => {
    return !packageData.private
  })
}
