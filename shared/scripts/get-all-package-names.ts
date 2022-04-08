import path from 'path'
import fs from 'fs-extra'
import { cwd } from 'process'

// @ts-ignore
import packageJson from '../../package.json'

async function getPackageName({ filePath }: { filePath: string }) {
  const packageJson = await fs.readJSON(filePath)
  return packageJson.name
}

async function getPackageNamesInFolder({
  targetFolder,
}: {
  targetFolder: string
}) {
  const sourceFolder = path.join(cwd(), targetFolder)

  const targetFolders = (await fs.readdir(sourceFolder)).filter((folder) => {
    return fs.pathExistsSync(path.join(sourceFolder, folder, '/package.json'))
  })

  const packageNames = await Promise.all(
    targetFolders.map((folder) =>
      getPackageName({
        filePath: path.join(sourceFolder, folder, '/package.json'),
      })
    )
  )

  return packageNames
}

export async function getAllPackageNames(): Promise<string[]> {
  let allPackageNames: string[] = []

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
    return getPackageNamesInFolder({ targetFolder })
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
