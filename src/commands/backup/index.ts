export * from './download/index.js'
export * from './flush/index.js'
export * from './list/index.js'
export * from './make/index.js'
export * from './restore/index.js'

import { Command } from 'commander'
import { make } from './make/index.js'
import { list } from './list/index.js'
import { restore } from './restore/index.js'
import { flush } from './flush/index.js'
import { download } from './download/index.js'
import { dateOnly } from '../../shared/index.js'

export const backup = async (program: Command) => {
  const cmd: Command = program
    .command('backups [command]')
    .description('Backup and restore your databases.')
    .usage('[command]')

  cmd
    .command('make')
    .description('Backup current environment state.')
    .action(make(program))

  cmd
    .command('list')
    .option(
      '-l, --limit <limit>',
      'Limit the number of displayed backups (all: 0).',
      '10',
    )
    .option(
      '-s, --sort <sort>',
      'Sort the order of the backups asc/desc.',
      'desc',
    )
    .description('List available backups.')
    .action(list(program))

  cmd
    .command('download')
    .option('--db <db>', 'DB instance name.')
    .option(
      '--file <file>',
      "The '.rdb' backup file to be downloaded. This option takes precedence over the '--date' option.",
    )
    .option(
      `-d, --date <${dateOnly.toLowerCase()}>`,
      'Select a date to get the latest available backup.',
    )
    .option(
      '--path <path>',
      "The path to save the file. This option take precedence over the '--date' option.",
    )
    .description('Download previous backups.')
    .action(download(program))

  cmd
    .command('restore')
    .description(
      'Upload a backup file or restore a previous version as the current one.',
    )
    .option('--db <db>', 'DB instance name.')
    .option(
      '--file <file>',
      "The '.rdb' backup file to be used. You can specify a file path or a file name from a backup previously uploaded to the cloud. This option takes precedence over the '--date' option.",
    )
    .option(
      `-d, --date <${dateOnly.toLowerCase()}>`,
      'Select a date to restore the latest available backup.',
    )
    .action(restore(program))

  cmd
    .command('flush')
    .description('Flush the current database.')
    .option('--db <db>', 'DB instance name.')
    .option(
      '--force',
      'Flush without confirmation. Warning! This action cannot be undone.',
    )
    .action(flush(program))
}
