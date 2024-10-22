import {
  replaceTilde,
  AppContext,
  isFileFromCloud,
} from '../../../shared/index.js'
import { getList } from '../list/index.js'

import { pathExists } from 'fs-extra'
import { resolve } from 'node:path'
import {
  backupsSelection,
  BackupsSorted,
  mountDBName,
} from '../../../helpers/index.js'
import { Command } from 'commander'

export const restore =
  (program: Command) =>
  async ({ db, file, date }): Promise<void> => {
    const context: AppContext = AppContext.getInstance(program)
    await context.getProgram()
    const { destroy } = await context.getBasedClients()

    try {
      await setRestore({
        context,
        db,
        file,
        date,
        verbose: true,
      })

      destroy()
      return
    } catch (error) {
      throw new Error(error)
    }
  }

export const setRestore = async ({
  context,
  db = '',
  file = '',
  date = '',
  verbose = false,
}: Based.Backups.Restore) => {
  const { basedClient } = await context.getBasedClients()
  const { skip } = context.getGlobalOptions()
  // TODO This function need to be refactored to remove this technical debit non related with the CLI
  // https://linear.app/1ce/issue/BASED-284/refactoring-baseddb-list-cloud-function
  const defaultDBInfo = await basedClient.call('based:db-list')
  const dbInfo = mountDBName(defaultDBInfo, db)
  const backups: BackupsSorted = await getList(context)

  let { selectedFile, selectedDB } = await backupsSelection({
    context,
    backups,
    db: dbInfo.name,
    file,
    showCurrent: false,
    date,
  })

  const isCloudFile: boolean = isFileFromCloud(selectedFile)
  const isExternalFile: boolean = !isCloudFile

  if (isExternalFile) {
    if (!(await pathExists(selectedFile))) {
      throw new Error(
        `The specified file '${selectedFile}' is invalid or does not exist. Please provide a valid file.`,
      )
    }

    if (!file.endsWith('.rdb')) {
      throw new Error(
        `The specified file '${selectedFile}' is invalid. Only '<b>.rdb</b>' files can be restored.`,
      )
    }

    if (verbose) {
      context.print.info(`<b>Selected file:</b> <cyan>${selectedFile}</cyan>`)
    }
  }

  if (verbose) {
    context.print
      .line()
      .info(`<b>Restore summary:</b>`)
      // TODO Fix the value coming from 'db'
      // https://linear.app/1ce/issue/BASED-284/refactoring-baseddb-list-cloud-function
      .info(`<b>Database:</b> <cyan>${selectedDB}</cyan>`)
      .info(
        `<b>File to be restored:</b> <cyan>${isExternalFile ? resolve(replaceTilde(selectedFile)) : selectedFile}</cyan>`,
      )
      .line()
  }

  if (isCloudFile) {
    if (!skip) {
      const doIt: boolean = await context.input.confirm()

      if (!doIt) {
        throw new Error('Restoration cancelled.')
      }
    }

    try {
      context.print.loading('Restoring your backup...')

      await basedClient.call('based:backups-select', {
        db: dbInfo,
        key: selectedFile,
      })
    } catch (error) {
      throw new Error(`Error restoring your file: '${error}'`)
    }
  }

  if (isExternalFile) {
    try {
      context.print.loading('Uploading file...')

      const result = await basedClient.stream('based:backups-upload', {
        path: selectedFile,
        payload: {
          db: dbInfo,
        },
      })

      if (!result.ok) {
        new Error(result)
      }
    } catch (error) {
      throw new Error(`Error uploading your file: '${error}'`)
    }
  }

  context.print
    .stop()
    .success(`Backup <cyan>${selectedFile}</cyan> restored successfully!`, true)
}
