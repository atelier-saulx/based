import { Argument, program } from 'commander'
import { command, GlobalOptions } from '../command'
import checkAuth from '../checkAuth'
import makeClient from '../makeClient'
import { downloadBackup } from './downloadBackup'
import { listBackups } from './listBackups'
import { makeBackup } from './makeBackup'
import { makeConfig } from '../makeConfig'
import { deleteAllBackups } from './deleteAllBackups'
import { deleteBackup } from './deleteBackup'
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
      new Argument('<action>', 'backup action').choices([
        'list',
        'make',
        'download',
        'remove',
        'remove-all',
      ])
    )
    .description('Manage remote backups')
).action(
  async (
    action: 'list' | 'make' | 'download' | 'remove' | 'remove-all',
    options: BackupOptions
  ) => {
    const config = await makeConfig(options)
    printHeader(options, config)

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

    if (action === 'list') {
      await listBackups(client, options, config)
    } else if (action === 'download') {
      await downloadBackup(client, options, config)
    } else if (action === 'make') {
      await makeBackup(client, options, config)
    } else if (action === 'remove-all') {
      await deleteAllBackups(client, options, config)
    } else if (action === 'remove') {
      await deleteBackup(client, options, config)
    }
    process.exit()
  }
)
