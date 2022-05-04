import { Argument, program } from 'commander'
import { command, GlobalOptions } from '../command'
import chalk from 'chalk'
import checkAuth from '../checkAuth'
import makeClient from '../makeClient'
import { downloadBackup } from './downloadBackup'
import { listBackups } from './listBackups'
import { makeBackup } from './makeBackup'
import { makeConfig } from '../makeConfig'
import { fail, printHeader } from '../tui'

export { downloadBackup, listBackups, makeBackup }

export type BackupOptions = GlobalOptions & {
  database?: string
  backupName?: string
}

command(
  program
    .command('backup')
    .option('--database <database>', "If left empty, equals to 'default'")
    .option(
      '--backup-name <backup-name>',
      'Name of backup to remove or download. Required for those two actions'
    )
    .addArgument(
      new Argument('<command>', 'backup commands').choices([
        'list',
        'make',
        'download',
        'remove',
      ])
    )
    .description('Manage remote backups')
).action(
  async (
    command: 'list' | 'make' | 'download' | 'remove',
    options: BackupOptions
  ) => {
    let { database } = options
    const config = await makeConfig(options)
    printHeader(options, config)

    if (!database) {
      database = 'default'
    }

    const token = await checkAuth(options)
    const client = makeClient(config.cluster)

    try {
      if (options.apiKey) {
        const result = await client.auth(token, { isApiKey: true })
        if (!result) fail('Invalid apiKey.', { data: [] }, options)
      } else {
        await client.auth(token)
      }
    } catch (error) {
      fail(error, { data: [] }, options)
    }

    if (command === 'list') {
      await listBackups(client, options, config)
    }
    if (command === 'download') {
      await downloadBackup(client, options, config).catch((e) => {
        console.error(chalk.red(e.message))
      })
      process.exit()
    }
    if (command === 'make') {
      try {
        await makeBackup(client, options, config)
      } catch (e) {
        console.error(e)
      }
    }
    if (command === 'remove') {
      // removeBackup(client, options)
    }
    process.exit()
  }
)
