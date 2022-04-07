/* eslint-disable no-console */
import path from 'path'
import chalk from 'chalk'
import fs from 'fs-extra'
import { execa } from 'execa'

/**
 * Publish target package
 */
export async function publishPackage({
  activePath,
  name,
  tag,
}: {
  activePath: string
  name: string
  tag: string
}) {
  try {
    // Publish target package to NPM registry
    await execa(
      'npm',
      [
        'publish',
        activePath,
        '--registry',
        'https://registry.npmjs.org/',
        '--access',
        'public',
        '--tag',
        tag,
      ],
      {
        stdio: 'inherit',
        cwd: activePath,
      }
    )

    console.log(`- Package ${chalk.cyan(name)} was published`)
  } catch (error: any) {
    console.error(`Failed to publish package ${chalk.red(name)}`)
    console.error(chalk.red`${error?.message}\n`)
    process.exit(1)
  }
}

/**
 * Publish all packages within target folder
 */
async function publishPackagesInFolder({
  inputFolder,
  tag,
}: {
  inputFolder: string
  tag: string
}) {
  const sourceFolder = path.join(process.cwd(), inputFolder)

  const targetFolders = (await fs.readdir(sourceFolder)).filter((folder) => {
    return fs.pathExistsSync(path.join(sourceFolder, folder, '/package.json'))
  })

  await Promise.all(
    targetFolders.map(async (folder) => {
      const packageJson = await fs.readJSON(
        path.join(sourceFolder, folder, '/package.json')
      )

      if (packageJson.private) {
        return console.log(
          `- Private package ${chalk.cyan(packageJson.name)} was skipped`
        )
      }

      await publishPackage({
        activePath: path.join(sourceFolder, folder),
        name: packageJson.name,
        tag,
      })
    })
  )
}

/**
 * Publish all packages in the project
 */
export async function publishAllPackagesInRepository({
  targetFolders,
  tag,
}: {
  targetFolders: string[]
  tag: string
}) {
  /**
   * Publish target packages
   */
  const publishPackagesPromises: Promise<void>[] = []

  targetFolders.forEach((inputFolder) => {
    const writeVersionToFolderPromise = publishPackagesInFolder({
      inputFolder,
      tag,
    })

    publishPackagesPromises.push(writeVersionToFolderPromise)
  })

  await Promise.all(publishPackagesPromises)
}
