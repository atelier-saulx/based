import { Command } from 'commander'
import {
  backupsSummary,
  backupsSelection,
  backupsSorting,
  basedAuth,
  BackupsSorted,
} from '../../../shared/index.js'
import { getDownload } from '../download/index.js'
import { BasedClient } from '@based/client'
import { setRestore } from '../restore/index.js'
import { setFlush } from '../flush/index.js'
import AppContext from '../../../shared/AppContext.js'

export const list =
  (program: Command, context: AppContext) =>
  async ({ limit = 10, sort = 'DESC' }: BasedCli.Backups.List.Args) => {
    const { org, project, env, cluster, yes: skip } = program.opts()
    const { basedClient, envHubBasedCloud, destroy } = await basedAuth(
      program,
      context,
    )

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
        await getDownload({
          context,
          basedClient,
          db: selectedDB,
          file: selectedFile,
          path: '',
        })

        destroy()
        return
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
        await setRestore({
          context,
          basedClient,
          db: selectedDB,
          file: selectedFile,
          isExternalFile: false,
        })

        destroy()
        return
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
      }
    }

    destroy()
    return
  }

export const getList = async (
  context: AppContext,
  envHubBasedCloud: BasedClient,
  limit: number = 10,
  sort: BasedCli.Backups.List.Args['sort'] = 'DESC',
  verbose: boolean = false,
): Promise<BackupsSorted> => {
  context.print.line().loading(`Searching for databases and backups...`)
  const { backups } = await envHubBasedCloud.call('based:backups-list')

  if (!Object.keys(backups).length) {
    context.print.fail(`There were no backups found.`)
  } else {
    context.print.stop()
  }

  const backupsSorted: BackupsSorted = backupsSorting(backups, limit, sort)

  backupsSummary(context, backupsSorted, limit, sort, verbose)

  return backupsSorted
}
