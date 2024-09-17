import { Command } from 'commander'
import {
  backupsSummary,
  backupsSelection,
  backupsSorting,
  basedAuth,
  BackupsSorted,
  spinner,
} from '../../../shared/index.js'
import confirm from '@inquirer/confirm'
import { getDownload } from '../download/index.js'
import { BasedClient } from '@based/client'
import { setRestore } from '../restore/index.js'
import { setFlush } from '../flush/index.js'

export const list = (program: Command) => async () => {
  const { org, project, env, cluster } = program.opts()
  const { basedClient, envHubBasedCloud, destroy } = await basedAuth(program)

  const backups: BackupsSorted = await getList(envHubBasedCloud, true)

  console.info('')

  const downloadBackup = await confirm({
    message: `Would you like to download any of this backups?`,
  })

  if (downloadBackup) {
    const { selectedFile, selectedDB } = await backupsSelection({
      backups,
    })
    await getDownload({
      basedClient,
      db: selectedDB,
      file: selectedFile,
      path: '',
    })

    destroy()
    return
  }

  const restoreBackup: boolean = await confirm({
    message: `Would you like to restore one of these backups and make it the current version of the database?`,
  })

  if (restoreBackup) {
    const { selectedFile, selectedDB } = await backupsSelection({
      backups,
      showCurrent: false,
    })
    await setRestore({
      basedClient,
      db: selectedDB,
      file: selectedFile,
      isExternalFile: false,
    })

    destroy()
    return
  }

  const deleteBackup: boolean = await confirm({
    message: `Would you like to flush the current database? (This action cannot be undone)`,
  })

  if (deleteBackup) {
    const { selectedDB } = await backupsSelection({
      backups,
      selectFile: false,
      showCurrent: false,
    })
    await setFlush({
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

  destroy()
  return
}

export const getList = async (
  envHubBasedCloud: BasedClient,
  verbose: boolean,
): Promise<BackupsSorted> => {
  spinner.start(`Searching for databases and backups...`)
  const { backups } = await envHubBasedCloud.call('based:backups-list')

  if (!Object.keys(backups).length) {
    spinner.fail(`There were no backups found.`)
    process.exit(1)
  } else {
    spinner.stop()
  }

  const backupsSorted: BackupsSorted = backupsSorting(backups)

  backupsSummary(backupsSorted, verbose)

  return backupsSorted
}
