import { Command } from 'commander'
import { basedAuth, AppContext } from '../../../shared/index.js'
import { getDownload } from '../download/index.js'
import { BasedClient } from '@based/client'
import { setRestore } from '../restore/index.js'
import { setFlush } from '../flush/index.js'
import {
  backupsSelection,
  BackupsSorted,
  backupsSorting,
  backupsSummary,
} from '../manageBackups.js'

export const list =
  (program: Command, context: AppContext) =>
  async ({ limit = 10, sort = 'desc' }: BasedCli.Backups.List.Args) => {
    const { org, project, env, cluster, yes: skip } = program.opts()
    const { basedClient, envHubBasedCloud, destroy } = await basedAuth(
      program,
      context,
    )
    sort = sort.toLowerCase() as BasedCli.Backups.List.Args['sort']

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

    const backups: BackupsSorted = await getList(
      context,
      envHubBasedCloud,
      limit,
      sort,
      true,
    )

    context.print.line()

    if (!skip) {
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
            basedClient,
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
            basedClient,
            db: selectedDB,
            file: selectedFile,
            isExternalFile: false,
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
          selectFile: false,
          showCurrent: false,
        })

        try {
          await setFlush({
            context,
            basedClient,
            db: selectedDB,
            org,
            project,
            env,
            cluster,
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
  envHubBasedCloud: BasedClient,
  limit: number = 10,
  sort: BasedCli.Backups.List.Args['sort'] = 'desc',
  verbose: boolean = false,
): Promise<BackupsSorted> => {
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
