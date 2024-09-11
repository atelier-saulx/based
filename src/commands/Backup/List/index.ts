import { Command } from 'commander'
import { basedAuth, spinner } from '../../../shared/index.js'
import pc from 'picocolors'
import confirm from '@inquirer/confirm'

export const list = (program: Command) => async () => {
  const { envHubBasedCloud, destroy } = await basedAuth(program)

  console.info(`\n🔎 Searching for databases and backups...`)
  const { backups } = await envHubBasedCloud.call('based:backups-list')

  if (!Object.keys(backups).length) {
    spinner.fail(
      `Could not get env info, check your based.json file or your arguments and try again.`,
    )
    process.exit(1)
  }

  for (const name in backups) {
    console.info(`📖  Database: ${pc.bold(pc.cyan(name))}`)

    for (let i = 0; i < backups[name].length; i++) {
      const backup = backups[name][i]
      console.info(`Backup: ${pc.dim(backup.key)}`)
    }
  }

  console.info('')
  const downloadBackup: boolean = await confirm({
    message: `Would you like to download any of this backups?`,
  })

  if (downloadBackup) {
    return
  }

  const restoreBackup: boolean = await confirm({
    message: `Would you like to restore one of these backups and make it the current version of the database?`,
  })

  if (restoreBackup) {
    return
  }

  const deleteBackup: boolean = await confirm({
    message: `Would you like to delete any of these backups? (This action cannot be undone)`,
  })

  if (deleteBackup) {
    return
  }

  destroy()
  return
}
