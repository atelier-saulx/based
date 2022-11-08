import { program } from 'commander'
import { command as addGlobalOptions, GlobalOptions } from '../command'
import { backupDownloadCommand } from './downloadBackup'
import { backupListCommand } from './listBackups'
import { backupMakeCommand } from './makeBackup'
import { backupDeleteCommand } from './deleteBackup'
import { backupDeleteAllCommand } from './deleteAllBackups'

export type BackupOptions = GlobalOptions & {
  database?: string
  filename?: string
}

program
  .command('backup')
  .description('Manage remote backups')
  .addCommand(addGlobalOptions(backupMakeCommand))
  .addCommand(addGlobalOptions(backupDownloadCommand))
  .addCommand(addGlobalOptions(backupListCommand))
  .addCommand(addGlobalOptions(backupDeleteCommand))
  .addCommand(addGlobalOptions(backupDeleteAllCommand))
