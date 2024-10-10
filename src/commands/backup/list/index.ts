import { AppContext } from '../../../shared/index.js'
import { getDownload } from '../download/index.js'
import { setRestore } from '../restore/index.js'
import { setFlush } from '../flush/index.js'
import {
  backupsSelection,
  BackupsSorted,
  backupsSorting,
  backupsSummary,
} from '../../../helpers/index.js'
import { Command } from 'commander'

export const list =
  (program: Command) =>
  async ({ limit = 10, sort = 'desc' }) => {
    const context: AppContext = AppContext.getInstance(program)
    const { skip } = context.getGlobalOptions()
    const { cluster, org, env, project } = await context.getProgram()
    const { destroy } = await context.getBasedClients()
    sort = sort.toLowerCase()

    if (sort && sort !== 'desc' && sort !== 'asc') {
      throw new Error(
        `The <b>sorting</b> option is not valid: '<b><cyan>${sort}</cyan></b>'. Check it and try again.`,
      )
    }

    if (isNaN(parseInt(limit.toString()))) {
      throw new Error(
        `The <b>limit</b> option is not valid: '<b><cyan>${limit}</cyan></b>'. Check it and try again.`,
      )
    }

    limit = Number(limit)

    const backups: BackupsSorted = await getList(context, limit, sort, true)

    if (!skip) {
      context.print.line()
      const downloadBackup = await context.input.confirm(
        `Would you like to download any of this backups?`,
      )

      if (downloadBackup) {
        const { selectedFile, selectedDB } = await backupsSelection({
          context,
          backups,
          sort,
        })

        try {
          await getDownload({
            context,
            db: selectedDB,
            file: selectedFile,
            path: '',
          })

          destroy()
          return
        } catch (error) {
          throw new Error(error)
        }
      }

      const restoreBackup: boolean = await context.input.confirm(
        `Would you like to restore one of these backups and make it the current version of the database?`,
      )

      if (restoreBackup) {
        const { selectedFile, selectedDB } = await backupsSelection({
          context,
          backups,
          sort,
          showCurrent: false,
        })

        try {
          await setRestore({
            context,
            db: selectedDB,
            file: selectedFile,
            date: '',
            verbose: true,
          })

          destroy()
          return
        } catch (error) {
          throw new Error(error)
        }
      }

      const deleteBackup: boolean = await context.input.confirm(
        `Would you like to flush the current database? (This action cannot be undone)`,
      )

      if (deleteBackup) {
        const { selectedDB } = await backupsSelection({
          context,
          backups,
          sort,
          file: '',
          showCurrent: false,
        })

        try {
          await setFlush({
            context,
            db: selectedDB,
            org,
            project,
            env,
            cluster,
            force: false,
          })

          destroy()
          return
        } catch (error) {
          throw new Error(error)
        }
      }
    }

    destroy()
    return
  }

export const getList = async (
  context: AppContext,
  limit: number = 10,
  sort = 'desc',
  verbose: boolean = false,
): Promise<BackupsSorted> => {
  const { envHubBasedCloud } = await context.getBasedClients()

  context.print.line().loading(`Searching for databases and backups...`)

  const { backups } = await envHubBasedCloud.call('based:backups-list')

  if (!Object.keys(backups).length) {
    throw new Error(`There were no backups found.`)
  } else {
    context.print.stop()
  }

  const backupsSorted: BackupsSorted = backupsSorting(backups, limit, sort)

  backupsSummary(context, backupsSorted, limit, sort, verbose)

  return backupsSorted
}
