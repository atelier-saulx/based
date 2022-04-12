import path from 'path'
import fs from 'fs-extra'
import { cwd } from 'process'

// @ts-ignore
import packageJson from '../../package.json'

export interface PackageData {
  name: string
  path: string
  version: string
  private?: boolean
}

async function getPackageName({
  targetPath,
}: {
  targetPath: string
}): Promise<PackageData> {
  const packageJSONPath = path.join(targetPath, '/package.json')
  const packageJson = await fs.readJSON(packageJSONPath)

  return {
    name: packageJson.name,
    version: packageJson.version,
    path: targetPath,
    private: packageJson.private ?? false,
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

export async function getAllPackages(): Promise<PackageData[]> {
  let allPackageNames: PackageData[] = []

  /**
   * Get all workspace folders. Filter out `/*`
   */
  const workspaceFolders = packageJson.workspaces.map((folder: string) => {
    return folder.replace(/[`~!@#$%^&*()_|+\-=?;:'",.<>{}[\]\\/]/gi, '')
  })

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

export async function getPublicPackages(): Promise<PackageData[]> {
  let allPackages: PackageData[] = []

  /**
   * Get all workspace folders. Filter out `/*`
   */
  const workspaceFolders = packageJson.workspaces.map((folder: string) => {
    return folder.replace(/[`~!@#$%^&*()_|+\-=?;:'",.<>{}[\]\\/]/gi, '')
  })

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
    allPackages = [...allPackages, ...packageNames]
  })

  /**
   * Only return public packages
   */
  return allPackages.filter((packageData) => {
    return !packageData.private
  })
}
