import path from 'path'
import fs from 'fs-extra'
import { cwd } from 'process'

// @ts-ignore
import packageJson from '../../package.json'

async function getPackageName({
  targetPath,
  includePrivatePackages = true,
}: {
  targetPath: string
  includePrivatePackages: boolean
}): Promise<PackageData | null> {
  const packageJSONPath = path.join(targetPath, '/package.json')
  const packageJson = await fs.readJSON(packageJSONPath)

  if (includePrivatePackages) {
    return packageJson.name
  }

  if (!includePrivatePackages && packageJson.private) {
    return null
  }

  return {
    name: packageJson.name,
    path: targetPath,
  }
}

async function getPackageNamesInFolder({
  targetFolder,
  includePrivatePackages = true,
}: {
  targetFolder: string
  includePrivatePackages: boolean
}): Promise<PackageData[]> {
  const sourceFolder = path.join(cwd(), targetFolder)

  const targetFolders = (await fs.readdir(sourceFolder)).filter((folder) => {
    return fs.pathExistsSync(path.join(sourceFolder, folder, '/package.json'))
  })

  const packageNames = await Promise.all(
    targetFolders.map((folder) =>
      getPackageName({
        targetPath: path.join(sourceFolder, folder),
        includePrivatePackages,
      })
    )
  )

  return packageNames.filter((packageName) => {
    return packageName !== null
  }) as PackageData[]
}

export interface PackageData {
  name: string
  path: string
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
      includePrivatePackages: true,
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
      includePrivatePackages: false,
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
