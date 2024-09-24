import { Command } from 'commander'
import {
  backupsSelection,
  BackupsSorted,
  basedAuth,
  replaceTilde,
} from '../../../shared/index.js'
import { getList } from '../list/index.js'
import { BasedClient } from '@based/client'
import { pathExists } from 'fs-extra'
import { resolve } from 'node:path'
import AppContext from '../../../shared/AppContext.js'

type RestoreArgs = {
  db?: string
  file?: string
}

type SetRestoreArgs = {
  context: AppContext
  basedClient: BasedClient
  db: string
  file: string
  isExternalFile: boolean
}

export const restore =
  (program: Command, context: AppContext) =>
  async ({ db, file }: RestoreArgs): Promise<void> => {
    const isExternalFile: boolean = file !== undefined
    const { basedClient, envHubBasedCloud, destroy } = await basedAuth(
      program,
      context,
    )
    const backups: BackupsSorted = await getList(context, envHubBasedCloud)

    let { selectedFile, selectedDB } = await backupsSelection({
      context,
      backups,
      selectDB: db,
      selectFile: !file,
      showCurrent: false,
    })

    if (isExternalFile) {
      selectedFile = file
    }

    await setRestore({
      context,
      basedClient,
      db: selectedDB,
      file: selectedFile,
      isExternalFile,
    })

    destroy()
    return
  }

export const setRestore = async ({
  context,
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
      context.print.fail(
        `The specified file '<cyan>${file}</cyan>' is invalid or does not exist. Please provide a valid file.`,
      )
    }

    if (!file.endsWith('.rdb')) {
      context.print.fail(
        `The specified file '<cyan>${file}</cyan>' is invalid. Only '<b>.rdb</b>' files can be restored.
`,
      )
    }

    context.print.info(`<b>Selected file:</b> <cyan>${file}</cyan>`)
  }

  context.print
    .line()
    .info(`<b>Restore summary:</b>`)
    // TODO Fix the value coming from 'db'
    // https://linear.app/1ce/issue/BASED-284/refactoring-baseddb-list-cloud-function
    .info(`<b>Database:</b> '<cyan>${dbInfo.name}</cyan>'`)
    .info(
      `<b>File to be restored:</b> '<cyan>${resolve(replaceTilde(file))}</cyan>'`,
    )
    .line()

  if (!isExternalFile) {
    const doIt: boolean = await context.input.confirm()

    if (!doIt) {
      context.print.fail('Restoration cancelled.')
    }

    try {
      context.print.loading('Restoring your backup...')

      await basedClient.call('based:backups-select', {
        db: dbInfo,
        key: file,
      })
    } catch (error) {
      context.print.fail(`Error restoring your file: '${error}'`)
    }
  }

  if (isExternalFile) {
    try {
      context.print.loading('Uploading file...')

      const result = await basedClient.stream('based:backups-upload', {
        path: file,
        payload: {
          db: dbInfo,
        },
      })

      if (!result.ok) {
        context.print.fail(`Error uploading your file: '${result}'`)
      }
    } catch (error) {
      context.print.fail(`Error uploading your file: '${error}'`)
    }
  }

  context.print.success(`Backup restored successfully!`)
}
