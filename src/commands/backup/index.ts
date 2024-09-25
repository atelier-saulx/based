import { Command } from 'commander'
import { make } from './make/index.js'
import { list } from './list/index.js'
import { restore } from './restore/index.js'
import { flush } from './flush/index.js'
import { download } from './download/index.js'
import { AppContext } from '../../shared/index.js'

export const backup = async (program: Command, context: AppContext) => {
  const cmd: Command = program
    .command('backups [command]')
    .description('Backup and restore your databases.')
    .usage('[command]')

  cmd
    .command('make')
    .description('Backup current environment state.')
    .action(make(program, context))

  cmd
    .command('list')
    .option(
      '-l, --limit <limit>',
      'Limit the number of displayed backups (default: 10)(all: 0).',
      '10',
    )
    .option(
      '-s, --sort <sort>',
      'Sort the order of the backups ASC/DESC (default: desc).',
      'desc',
    )
    .description('List available backups.')
    .action(list(program, context))

  cmd
    .command('download')
    .option('--db <db>', 'DB instance name.')
    .option('--file <file>', '.rdb backup file to upload.')
    .option('--path <path>', 'The path to save the file.')
    .description('Download previous backups.')
    .action(download(program, context))

  cmd
    .command('restore')
    .description(
      'Upload a backup file or restore a previous version as the current one.',
    )
    .option('--db <db>', 'DB instance name.')
    .option('--file <file>', '.rdb backup file to upload.')
    .action(restore(program, context))

  cmd
    .command('flush')
    .description('Flush the current database.')
    .option('--db <db>', 'DB instance name.')
    .action(flush(program, context))
}
