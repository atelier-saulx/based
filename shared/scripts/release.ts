/* eslint-disable no-unused-vars */
/* eslint-disable @typescript-eslint/no-unused-vars */
/* eslint-disable no-console */

import path from 'path'
import simpleGit from 'simple-git'
import open from 'open'
import githubRelease from 'new-github-release-url'
import yargs from 'yargs/yargs'
import { hideBin } from 'yargs/helpers'
import { execa } from 'execa'
import { prompt } from 'enquirer'

import { getPublicPackages, PackageData } from './get-package-data'
import { ReleaseType } from './types'

import { publishTargetPackage } from './publish-packages'
import {
  patchRepositoryVersion,
  updateTargetPackageVersion,
} from './update-versions'

import {
  FormatOptions,
  getIncrementedVersion,
  validateReleaseType,
} from './utilities'

// @ts-ignore
import packageJson from '../../package.json'

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
  .example([
    ['$0 minor', 'Release minor update.'],
    ['$0 --type minor', 'Release minor update.'],
  ])

const getBranch = async () => {
  const currentBranch = await git.raw('rev-parse', '--abbrev-ref', 'HEAD')
  return currentBranch.trim()
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

  const { type } = argv as ReleaseOptions

  const inputType = argv._[0] ?? type
  let releaseType = validateReleaseType(inputType)

  const targetPackages: PackageData[] = []

  const targetFolders = packageJson.workspaces.map((folder: string) => {
    return folder.replace(/[`~!@#$%^&*()_|+\-=?;:'",.<>{}[\]\\/]/gi, '')
  })

  console.info(`\n  Releasing Based\n`)

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

  console.info(`\n  Released the following packages successfully: \n`)

  for (const packageData of targetPackages) {
    console.info(`  - ${packageData.name} version ${packageData.version}`)
  }

  return

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

  const targetTag = packageJson.version

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
    console.error('Release failed. Error: %o. \n', getErrorMessage(error))

    return process.exit(1)
  }
})()

function getErrorMessage(input: any) {
  const fallbackMessage = 'Unknown error'
  const rootMessage = input?.message ?? input ?? ''
  const errorMessage = rootMessage !== '' ? rootMessage : fallbackMessage
  return errorMessage
}
