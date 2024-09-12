import { Command } from 'commander'
import {
  backupsSummary,
  backupsSelection,
  backupsSorting,
  basedAuth,
  BackupsSorted,
} from '../../../shared/index.js'
import confirm from '@inquirer/confirm'
import { getDownload } from '../download/index.js'
import { BasedClient } from '@based/client'

export const list = (program: Command, verbose: boolean) => async () => {
  const { basedClient, envHubBasedCloud, destroy } = await basedAuth(program)

  const backupsSorted: BackupsSorted = await getList(envHubBasedCloud, verbose)

  console.info('')

  const downloadBackup = await confirm({
    message: `Would you like to download any of this backups?`,
  })

  if (downloadBackup) {
    const selectedBackup: string = await backupsSelection(backupsSorted)
    await getDownload(basedClient, selectedBackup)

    destroy()
    return
  }

  const restoreBackup: boolean = await confirm({
    message: `Would you like to restore one of these backups and make it the current version of the database?`,
  })

  if (restoreBackup) {
    const selectedBackup: string = await backupsSelection(backupsSorted)
    console.log('restore ---->>', selectedBackup)

    destroy()
    return
  }

  const deleteBackup: boolean = await confirm({
    message: `Would you like to delete any of these backups? (This action cannot be undone)`,
  })

  if (deleteBackup) {
    const selectedBackup: string = await backupsSelection(backupsSorted)
    console.log('delete ---->>', selectedBackup)

    destroy()
    return
  }

  destroy()
  return
}

export const getList = async (
  envHubBasedCloud: BasedClient,
  verbose: boolean,
): Promise<BackupsSorted> => {
  console.info(`\n🔎 Searching for databases and backups...`)
  const { backups } = await envHubBasedCloud.call('based:backups-list')
  const backupsSorted: BackupsSorted = backupsSorting(backups)

  backupsSummary(backupsSorted, verbose)

  return backupsSorted
}
