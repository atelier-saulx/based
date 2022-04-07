/* eslint-disable no-console */
import path from 'path'
import chalk from 'chalk'
import fs from 'fs-extra'
import { execa } from 'execa'

/**
 * Publish target package
 */
export async function publishPackage({
  path,
  name,
  tag,
}: {
  path: string
  name: string
  tag: string
}) {
  try {
    // Publish target package to NPM registry
    await execa(
      'npm',
      [
        'publish',
        path,
        '--registry',
        'https://registry.npmjs.org/',
        '--access',
        'public',
        '--tag',
        tag,
      ],
      {
        stdio: 'inherit',
        cwd: path,
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
  version: string
  tag: string
}) {
  const sourceFolder = path.join(__dirname, `../${inputFolder}`)

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
        path: path.join(sourceFolder, folder),
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
  version,
  tag,
}: {
  version: string
  tag: string
}) {
  /**
   * Publish all public packages
   */
  await publishPackagesInFolder({
    inputFolder: 'packages',
    version,
    tag,
  })

  /**
   * Publish all public apps
   */
  await publishPackagesInFolder({
    inputFolder: 'apps',
    version,
    tag,
  })
}
