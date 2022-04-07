import path from 'path'
import fs from 'fs-extra'

async function writeVersionToPackageJson({
  filePath,
  version,
}: {
  filePath: string
  version: string
}) {
  const packageJson = await fs.readJSON(filePath)

  packageJson.version = version

  await fs.writeJSON(filePath, packageJson, { spaces: 2 })
}

async function writeVersionToModulesInFolder(
  inputFolder: string,
  version: string
) {
  const sourceFolder = path.join(__dirname, `../${inputFolder}`)

  const targetFolders = (await fs.readdir(sourceFolder)).filter((folder) => {
    return fs.pathExistsSync(path.join(sourceFolder, folder, '/package.json'))
  })

  await Promise.all(
    targetFolders.map((folder) =>
      writeVersionToPackageJson({
        filePath: path.join(sourceFolder, folder, '/package.json'),
        version,
      })
    )
  )
}

export async function updatePackageVersionsInRepository({
  version,
  folders,
}: {
  version: string
  folders: string[]
}) {
  /**
   * Update package version in target folders
   */
  const writeVersionsPromises: any = []

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
    filePath: path.join(__dirname, '../package.json'),
    version,
  })
}
