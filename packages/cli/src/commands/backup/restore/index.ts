import { resolve } from 'node:path'
import type { Command } from 'commander'
import { pathExists } from 'fs-extra'
import { AppContext } from '../../../context/index.js'
import { backupsSelection, mountDBName } from '../../../helpers/index.js'
import { isFileFromCloud, replaceTilde } from '../../../shared/index.js'
import { getList } from '../list/index.js'

export const restore =
  (program: Command) =>
  async (args: Based.Backups.Restore.Command): Promise<void> => {
    const { db, file, date } = args
    const context: AppContext = AppContext.getInstance(program)
    await context.getProgram()
    const { destroy } = await context.getBasedClient()

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

export const setRestore = async (args: Based.Backups.Restore.Set) => {
  const { context, db = '', file = '', date = '', verbose = false } = args
  const basedClient = await context.getBasedClient()
  const { skip } = context.getGlobalOptions()

  // TODO This function need to be refactored to remove this technical debit non related with the CLI
  // https://linear.app/1ce/issue/BASED-284/refactoring-baseddb-list-cloud-function
  const defaultDBInfo = await basedClient.call(context.endpoints.DB_LIST)
  const dbInfo = mountDBName(defaultDBInfo, db)
  const backups: Based.Backups.Sorted = await getList({ context })

  const { selectedFile, selectedDB } = await backupsSelection({
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
      context.print.log(`<b>Selected file:</b> <cyan>${selectedFile}</cyan>`)
    }
  }

  if (verbose) {
    context.print
      .line()
      .info(
        context.i18n(
          'commands.backups.subCommands.restore.methods.summary.header',
        ),
      )
      // TODO Fix the value coming from 'db'
      // https://linear.app/1ce/issue/BASED-284/refactoring-baseddb-list-cloud-function
      .info(
        context.i18n(
          'commands.backups.subCommands.restore.methods.summary.database',
          selectedDB,
        ),
      )
      .info(
        context.i18n(
          'commands.backups.subCommands.restore.methods.summary.file',
          isExternalFile ? resolve(replaceTilde(selectedFile)) : selectedFile,
        ),
      )
      .line()
  }

  if (isCloudFile) {
    if (!skip) {
      const doIt: boolean = await context.form.boolean(
        context.i18n(
          'commands.backups.subCommands.restore.methods.confirmation',
        ),
      )

      if (!doIt) {
        return
      }
    }

    try {
      context.spinner.start(
        context.i18n('commands.backups.subCommands.restore.methods.restoring'),
      )

      await basedClient.call(context.endpoints.BACKUPS_SELECT, {
        db: dbInfo,
        key: selectedFile,
      })

      context.spinner.stop()
    } catch (error: unknown) {
      throw new Error(context.i18n('errors.908', error))
    }
  }

  if (isExternalFile) {
    try {
      context.spinner.start(context.i18n('methods.uploadingFile'))

      const result = await basedClient.call(context.endpoints.BACKUPS_UPLOAD, {
        path: selectedFile,
        payload: {
          db: dbInfo,
        },
      })

      context.spinner.stop()

      if (!result.ok) {
        throw new Error(result)
      }
    } catch (error: unknown) {
      throw new Error(context.i18n('errors.909', error))
    }
  }

  context.print.success(
    context.i18n(
      'commands.backups.subCommands.restore.methods.success',
      selectedFile,
    ),
    true,
  )
}
