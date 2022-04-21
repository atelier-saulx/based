/* eslint-disable no-unused-vars */
/* eslint-disable @typescript-eslint/no-unused-vars */
/* eslint-disable no-console */

import path from 'path'
import simpleGit from 'simple-git'
import open from 'open'
import fs from 'fs-extra'
import githubRelease from 'new-github-release-url'
import yargs from 'yargs/yargs'
import { hideBin } from 'yargs/helpers'
import { execa } from 'execa'
import { prompt } from 'enquirer'

import {
  getAllPackages,
  getPublicPackages,
  PackageData,
} from './get-package-data'
import { ReleaseType } from './types'

import { publishTargetPackage } from './publish-packages'
import {
  patchRepositoryVersion,
  updateTargetPackageVersion,
} from './update-versions'

import {
  findAllDependencies,
  getFormattedObject,
  getIncrementedVersion,
  getWorkspaceFolders,
  validateReleaseType,
} from './utilities'

import chalk from 'chalk'

const git = simpleGit()

export type ReleaseOptions = {
  type: string
  dryRun: boolean
}

const { argv }: { argv: any } = yargs(hideBin(process.argv))
  .option('type', {
    type: 'string',
    default: 'patch',
    description: 'Type <patch|minor|major>',
  })
  .option('dry-run', {
    type: 'boolean',
    default: false,
    description: 'Dry-run release',
  })
  .example([
    ['$0 minor', 'Release minor update.'],
    ['$0 --type minor', 'Release minor update.'],
    ['$0 --dry-run', 'Test CLI interaction, nothing else.'],
  ])

const getBranch = async () => {
  const currentBranch = await git.raw('rev-parse', '--abbrev-ref', 'HEAD')
  return currentBranch.trim()
}

const printReleaseOptions = ({
  releaseType,
  targetPackages,
  allPackages,
}: {
  releaseType: string
  targetPackages: PackageData[]
  allPackages: PackageData[]
}) => {
  const clonedTargetPackages = [...targetPackages]

  const printedOptions = {
    releaseType: releaseType,
  }

  console.info(`\n  ${chalk.bold('[ Release Options ]')} \n`)

  getFormattedObject(printedOptions).forEach(([message, value]) => {
    console.info(`  ${chalk.white(message)}: ${chalk.bold.yellow(value)}`)
  })

  console.info(`\n  ${chalk.bold('Target packages:')} \n`)

  for (const packageData of clonedTargetPackages) {
    const currentVersion = `${packageData.version}`

    packageData.version = getIncrementedVersion({
      version: packageData.version,
      type: releaseType,
    })

    console.info(
      `  ${chalk.green(packageData.name)}: ${chalk.gray.strikethrough(
        currentVersion
      )} ${chalk.bold.yellow(packageData.version)}`
    )
  }

  const dependencies = findAllDependencies({
    targetPackages: clonedTargetPackages,
    allPackages,
  })

  if (dependencies.length > 0) {
    console.info(
      `\n  ${chalk.bold.white(
        '-------------------------------------------------------'
      )}`
    )

    console.info(`\n  ${chalk.bold.underline.yellow('IMPORTANT')} \n`)

    console.info(
      `  ${chalk.bold.white(
        'The following packages has outdated peer-dependencies:'
      )} \n`
    )

    dependencies.forEach(({ targetPackage, dependency }) => {
      console.info(
        `  ${chalk.yellow.bold(dependency.name)} depends on ${chalk.yellow.bold(
          targetPackage.name
        )} version ${chalk.yellow.bold(dependency.legacyVersion)}.`
      )

      console.info(
        `  Consider updating it to ${chalk.yellow.bold.underline(
          targetPackage.version
        )}. \n`
      )
    })

    console.info(
      `\n  ${chalk.bold.white(
        'We recommend updating peer-deps for those packages.'
      )}`
    )

    console.info(
      `\n  ${chalk.bold.white(
        '-------------------------------------------------------'
      )}`
    )
  }

  console.info(`\n`)
}

async function releaseProject() {
  // const currentBranch = await getBranch()
  // if (currentBranch !== 'main') {
  //   throw new Error(
  //     `Incorrect branch: ${currentBranch}. We only release from main branch.`
  //   )
  // }

  // const status = await git.status()
  // if (status.files.length !== 0) {
  //   throw new Error(
  //     'You have unstaged changes in git. To release, commit or stash all changes.'
  //   )
  // }

  const { type, dryRun: isDryRun } = argv as ReleaseOptions

  const inputType = argv._[0] ?? type
  let releaseType = validateReleaseType(inputType)

  const targetPackages: PackageData[] = []
  const targetFolders = await getWorkspaceFolders()

  console.info(`\n${chalk.white.underline.bold('[ Releasing Based ]')} \n`)

  const allPackages = await getAllPackages()
  const publicPackages = await getPublicPackages()

  const publicPackageNames = publicPackages.map(
    (packageData) => packageData.name
  )

  await prompt<{
    chosenPackages: string[]
  }>({
    message: 'Select packages you want to release',
    name: 'chosenPackages',
    type: 'multiselect',
    choices: publicPackageNames,
    initial: publicPackageNames[0],
  } as any).then(({ chosenPackages }) => {
    if (!chosenPackages) {
      console.info('User aborted the release.')
      process.exit(0)
    }

    targetPackages.push(
      ...publicPackages.filter(({ name }) => {
        return chosenPackages.includes(name)
      })
    )
  })

  if (targetPackages.length === 0) {
    throw new Error("You didn't select any packages to release.")
  }

  await prompt<{ chosenReleaseType: ReleaseType }>([
    {
      type: 'select',
      name: 'chosenReleaseType',
      message: 'Select release type',
      initial: 0,
      choices: [
        { name: 'patch', message: 'Patch' },
        { name: 'minor', message: 'Minor' },
        { name: 'major', message: 'Major' },
      ],
    },
  ]).then(({ chosenReleaseType }) => {
    releaseType = chosenReleaseType
  })

  /**
   * Print release options
   */
  printReleaseOptions({
    releaseType,
    targetPackages,
    allPackages,
  })

  return false

  /**
   * Allow us to abort the release
   */
  await prompt<{
    shouldRelease: boolean
  }>({
    message: 'Do you want to to release?',
    name: 'shouldRelease',
    type: 'toggle',
    initial: true,
    enabled: 'Yes',
    disabled: 'No',
  } as any).then(({ shouldRelease }) => {
    if (!shouldRelease) {
      console.info('You aborted the release.')
      process.exit(0)
    }
  })

  if (isDryRun) {
    console.info(
      `\n  ${chalk.bold('[ Aborted. This was a dry run release. ]')} \n`
    )
    process.exit(0)
  }

  /**
   * Build project to ensure latest changes are present
   */
  try {
    await execa('npm', ['run', 'build'], { stdio: 'inherit' })
  } catch (error) {
    console.error({ error })

    throw new Error('Error encountered when building project.')
  }

  /**
   * Update version of all target packages
   */
  try {
    for (const packageData of targetPackages) {
      packageData.version = getIncrementedVersion({
        version: packageData?.version,
        type: releaseType,
      })

      await updateTargetPackageVersion({
        packageData: packageData,
        targetVersion: packageData.version,
      })
    }

    /**
     * Keep track of releases by patching workspace version
     */
    await patchRepositoryVersion()
  } catch (error) {
    console.error({ error })

    throw new Error('There was an error updating package versions')
  }

  /**
   * Publish all public packages in repository
   */
  for (const packageData of targetPackages) {
    await publishTargetPackage({
      packageData,
      tag: 'latest',
    }).catch((error) => {
      console.error({ error })
      throw new Error(
        `Publishing to NPM failed for package: ${packageData.name}.`
      )
    })
  }

  console.info(
    `\n  ${chalk.bold('Released the following packages successfully:')} \n`
  )
  targetPackages.forEach(({ name, version }) => {
    console.info(
      `  ${chalk.white(name)}: version ${chalk.bold.yellow(version)}`
    )
  })
  console.info(`\n`)

  /**
   * Stage and commit + push target version
   */
  // Add root package.json
  const addFiles = []

  // Add target folder package.jsons
  addFiles.push(path.join(process.cwd(), './package.json'))

  targetFolders.forEach((folder) => {
    addFiles.push(path.join(process.cwd(), folder))
  })

  const packageJSONPath = path.join(process.cwd(), './package.json')
  const upToDatePackageJSON = await fs.readJSON(packageJSONPath)

  const targetTag = upToDatePackageJSON.version

  await git.add(addFiles)

  await git.commit(`[release] Version: ${targetTag}`)

  await git.push()

  await git.addAnnotatedTag(targetTag, `[release] Version: ${targetTag}`)

  /**
   * Open up a browser tab within github to publish new release
   */
  open(
    githubRelease({
      user: 'atelier-saulx',
      repo: 'based',
      tag: targetTag,
      title: targetTag,
    })
  )

  console.info(`\n  The release process has finished. \n`)
}

;(async () => {
  try {
    await releaseProject()
  } catch (error) {
    console.error('\nRelease failed. Error: %o. \n', getErrorMessage(error))

    return process.exit(1)
  }
})()

function getErrorMessage(input: any) {
  const fallbackMessage = 'Unknown error'
  const rootMessage = input?.message ?? input ?? ''
  const errorMessage = rootMessage !== '' ? rootMessage : fallbackMessage
  return errorMessage
}
