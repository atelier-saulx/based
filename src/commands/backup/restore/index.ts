import { Command } from 'commander'
import {
  backupsSelection,
  BackupsSorted,
  basedAuth,
  replaceTilde,
  spinner,
} from '../../../shared/index.js'
import { getList } from '../list/index.js'
import { BasedClient } from '@based/client'
import pc from 'picocolors'
import confirm from '@inquirer/confirm'
import { pathExists } from 'fs-extra'
import { resolve } from 'node:path'

type RestoreArgs = {
  db?: string
  file?: string
}

type SetRestoreArgs = {
  basedClient: BasedClient
  db: string
  file: string
  isExternalFile: boolean
}

export const restore =
  (program: Command) =>
  async ({ db, file }: RestoreArgs): Promise<void> => {
    const isExternalFile: boolean = file !== undefined
    const { basedClient, envHubBasedCloud, destroy } = await basedAuth(program)
    const backups: BackupsSorted = await getList(envHubBasedCloud, false)

    let { selectedFile, selectedDB } = await backupsSelection({
      backups,
      selectDB: db,
      selectFile: !file,
      showCurrent: false,
    })

    if (isExternalFile) {
      selectedFile = file
    }

    await setRestore({
      basedClient,
      db: selectedDB,
      file: selectedFile,
      isExternalFile,
    })

    destroy()
    return
  }

export const setRestore = async ({
  basedClient,
  db,
  file,
  isExternalFile,
}: SetRestoreArgs) => {
  // TODO This function need to be refactored to remove this technical debit non related with the CLI
  // https://linear.app/1ce/issue/BASED-284/refactoring-baseddb-list-cloud-function
  const defaultDBInfo = await basedClient.call('based:db-list')
  const dbInfo = { ...defaultDBInfo[0], name: db }

  if (isExternalFile) {
    if (!(await pathExists(file))) {
      spinner.fail(
        `The specified file '${pc.cyan(file)}' is invalid or does not exist. Please provide a valid file.
`,
      )
      process.exit(1)
    }

    if (!file.endsWith('.rdb')) {
      spinner.fail(
        `The specified file '${pc.cyan(file)}' is invalid. Only '${pc.bold('.rdb')}' files can be restored.
`,
      )
      process.exit(1)
    }

    console.info(`📂 ${pc.bold('Selected file:')} ${pc.cyan(file)}`)
  }

  console.info(`\n${pc.bold('Restore summary:')}`)
  // TODO Fix the value coming from 'db'
  // https://linear.app/1ce/issue/BASED-284/refactoring-baseddb-list-cloud-function
  console.info(`${pc.bold('Database:')} '${pc.cyan(dbInfo.name)}'`)
  console.info(
    `${pc.bold('File to be restored:')} '${pc.cyan(resolve(replaceTilde(file)))}'`,
  )

  if (!isExternalFile) {
    const doIt: boolean = await confirm({
      message: 'Continue?',
      default: true,
    })

    if (!doIt) {
      spinner.fail('Restoration cancelled.')
      process.exit(1)
    }

    try {
      spinner.start('Restoring your backup...')

      await basedClient.call('based:backups-select', {
        db: dbInfo,
        key: file,
      })
    } catch (error) {
      spinner.fail(`Error restoring your file: '${error}'`)
      process.exit(1)
    }
  }

  if (isExternalFile) {
    try {
      console.log('')
      spinner.start('Uploading file...')

      const result = await basedClient.stream('based:backups-upload', {
        path: file,
        payload: {
          db: dbInfo,
        },
      })

      if (!result.ok) {
        spinner.fail(`Error uploading your file: '${result}'`)
        process.exit(1)
      }
    } catch (error) {
      spinner.fail(`Error uploading your file: '${error}'`)
      process.exit(1)
    }
  }

  spinner.succeed(`Backup restored successfully!`)
}
