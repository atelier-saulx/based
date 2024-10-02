import { basedAuth, replaceTilde, AppContext } from '../../../shared/index.js'
import { getList } from '../list/index.js'
import { BasedClient } from '@based/client'
import { pathExists } from 'fs-extra'
import { resolve } from 'node:path'
import { backupsSelection, BackupsSorted } from '../../../helpers/index.js'
import { Command } from 'commander'

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
  (program: Command) =>
  async ({ db, file }: RestoreArgs): Promise<void> => {
    const context: AppContext = AppContext.getInstance(program)
    const isExternalFile: boolean = file !== undefined
    const { basedClient, envHubBasedCloud, destroy } = await basedAuth(context)
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

    try {
      await setRestore({
        context,
        basedClient,
        db: selectedDB,
        file: selectedFile,
        isExternalFile,
      })

      destroy()
      return
    } catch (error) {
      throw new Error(error)
    }
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
      throw new Error(
        `The specified file '<cyan>${file}</cyan>' is invalid or does not exist. Please provide a valid file.`,
      )
    }

    if (!file.endsWith('.rdb')) {
      throw new Error(
        `The specified file '<cyan>${file}</cyan>' is invalid. Only '<b>.rdb</b>' files can be restored.`,
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
      throw new Error('Restoration cancelled.')
    }

    try {
      context.print.loading('Restoring your backup...')

      await basedClient.call('based:backups-select', {
        db: dbInfo,
        key: file,
      })
    } catch (error) {
      throw new Error(`Error restoring your file: '${error}'`)
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
        new Error(result)
      }

      context.print.success(`Backup restored successfully!`)
    } catch (error) {
      throw new Error(`Error uploading your file: '${error}'`)
    }
  }
}
