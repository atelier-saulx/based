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
  findOutdatedDependencies,
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

const checkReleaseOptions = async ({
  releaseType,
  targetPackages,
  allPackages,
}: {
  releaseType: string
  targetPackages: PackageData[]
  allPackages: PackageData[]
  isDryRun: boolean
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
    const { name, version } = packageData

    const currentVersion = `${version}`

    const targetVersion = getIncrementedVersion({
      version: packageData.version,
      type: releaseType,
    })

    console.info(
      `  ${chalk.green(name)} ~ Current version: ${chalk.bold.yellow(
        currentVersion
      )}. New version: ${chalk.bold.yellow(targetVersion)}.`
    )
  }

  const outdatedDependencies = findOutdatedDependencies({
    targetPackages: clonedTargetPackages,
    allPackages,
  })

  const hasOutdatedDependencies = outdatedDependencies.length > 0
  if (hasOutdatedDependencies) {
    console.info(`\n  ${chalk.bold.yellow('[ Notice ]')} \n`)

    console.info(
      `  ${chalk.bold.white(
        'The following packages has outdated peer- and dev-dependencies:'
      )} \n`
    )

    outdatedDependencies.forEach(({ targetPackage, dependencyPackage }) => {
      const { type } = dependencyPackage

      const dependencyString =
        type === 'peer' ? 'peer-dependency' : 'dev-dependency'

      console.info(
        `  ${chalk.green.bold(
          dependencyPackage.name
        )} has ${dependencyString} to ${chalk.yellow.bold(
          targetPackage.name
        )} with version ${chalk.red.bold(
          dependencyPackage.legacyVersion
        )}, not ${chalk.yellow.bold(targetPackage.version)}.`
      )
    })
  }

  /**
   * Allow us to abort the release
   */
  console.info(`\n`)

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
}

const performGitStatus = async () => {
  const currentBranch = await getBranch()
  if (currentBranch !== 'main') {
    throw new Error(
      `Incorrect branch: ${currentBranch}. We only release from main branch.`
    )
  }

  const status = await git.status()
  if (status.files.length !== 0) {
    throw new Error(
      'You have unstaged changes in git. To release, commit or stash all changes.'
    )
  }
}

async function releaseProject() {
  /**
   * Ensure we are on correct branch with clean git status.
   */
  await performGitStatus()

  console.info(`\n${chalk.white.underline.bold('[ Releasing Based ]')} \n`)

  const { type, dryRun: isDryRun } = argv as ReleaseOptions

  if (isDryRun) {
    console.info(`${chalk.bold('~ This is a dry run release ~')} \n`)
  }

  const inputType = argv._[0] ?? type
  let releaseType = validateReleaseType(inputType)

  const targetPackages: PackageData[] = []
  const targetFolders = await getWorkspaceFolders()

  const allPackages = await getAllPackages()
  const publicPackages = await getPublicPackages()

  const publicPackageNames = publicPackages.map(
    (packageData) => packageData.name
  )

  await prompt<{
    chosenPackages: string[]
  }>({
    message: 'Select the packages you want to release',
    name: 'chosenPackages',
    type: 'multiselect',
    choices: publicPackageNames,
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
  await checkReleaseOptions({
    releaseType,
    targetPackages,
    allPackages,
    isDryRun,
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
      const targetVersion = getIncrementedVersion({
        version: packageData?.version,
        type: releaseType,
      })

      await updateTargetPackageVersion({
        packageData: packageData,
        targetVersion: targetVersion,
      })

      // Set version for future use
      packageData.version = targetVersion
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
   * Publish chosen target packages in repository
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
  const addFiles = []

  // Add root package.json
  addFiles.push(path.join(process.cwd(), './package.json'))

  // Add target folder package.jsons
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
