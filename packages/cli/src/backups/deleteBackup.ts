import inquirer from 'inquirer'
import {
  fail,
  inquirerConfig,
  prefixError,
  prefixSuccess,
  printHeader,
} from '../tui'
import { BackupOptions } from '.'
import { GenericOutput } from '../types'
import { Command } from 'commander'
import checkAuth from '../checkAuth'
import makeClient from '../makeClient'
import { makeConfig } from '../makeConfig'

type BackupInfo = {
  Key: string
  LastModified: string
  ETag: string
  Size: number
  StorageClass: string
}

type BackupListOutput = GenericOutput & {
  data: BackupInfo[]
}

export const backupDeleteCommand = new Command('delete')
  .description('‼️ Permanently delete remote backup')
  .option(
    '-db --database <name>',
    "Name of the database, defaults to 'default'"
  )
  .option('-f --filename <name>', 'Name of the remote file to download')
  .action(async (options: BackupOptions) => {
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

    const output: BackupListOutput = { data: [] }
    let { database, filename } = options

    if (!database) database = 'default'
    if (!filename) {
      console.info(prefixError + 'Must include a backup name')
      process.exit()
    }

    Object.assign(options, config)
    const backups: BackupInfo[] = await client.call('listBackups', options)
    if (!backups || backups.length === 0) {
      fail('No backups found', output, options)
    }

    if (options.output === 'fancy') {
      const { sure } = await inquirer.prompt({
        ...inquirerConfig,
        type: 'confirm',
        name: 'sure',
        message: `Are you sure you want to delete backup ${filename} for the ${database} database? This action is irreversible.`,
      })

      if (!sure) {
        fail('Aborted.', output, options)
      }

      const res = await client.call('removeBackup', {
        ...config,
        database,
        key: filename,
      })

      if (res.error) fail(res.message, output, options)
      else console.info(prefixSuccess + 'Backup deleted.')
    } else if (options.output === 'json') {
      // output.data = res
      // console.info(JSON.stringify(output, null, 2))
    }

    process.exit(0)
  })
