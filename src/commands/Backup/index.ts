import { Command } from 'commander'
import { make } from './Make/index.js'
import { list } from './List/index.js'
import { download } from './Download/index.js'
import { restore } from './Restore/index.js'
import { flush } from './Flush/index.js'

export const backup = async (program: Command) => {
  const cmd: Command = program
    .command('backup [command]')
    .description('Backup and restore your databases.')
    .usage('[command]')

  cmd
    .command('make')
    .description('Backup current environment state.')
    .action(make(program))

  cmd
    .command('list')
    .description('List available backups.')
    .action(list(program))

  cmd
    .command('download')
    .option('-f, --file <file>', '.rdb backup file to upload.')
    .description('Download previous backups.')
    .action(download)

  cmd
    .command('restore')
    .description(
      'Upload a backup file or restore a previous version as the current one.',
    )
    .option('-f, --file <file>', '.rdb backup file to upload.')
    .action(restore)

  cmd.command('flush').description('delete all database contents').action(flush)
}
