import { Based } from '@based/client'
import inquirer from 'inquirer'
import { fail, inquirerConfig, prefixError, prefixSuccess } from '../tui'
import { BackupOptions } from '.'
import { Config, GenericOutput } from '../types'

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

export async function deleteBackup(
  client: Based,
  options: BackupOptions,
  config: Config
) {
  const output: BackupListOutput = { data: [] }
  let { database, backupName } = options

  if (!database) database = 'default'
  if (!backupName) {
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
      message: `Are you sure you want to delete backup ${backupName} for the ${database} database? This action is irreversible.`,
    })

    if (!sure) {
      fail('Aborted.', output, options)
    }

    const res = await client.call('removeBackup', {
      ...config,
      database,
      key: backupName,
    })

    if (res.error) fail(res.message, output, options)
    else console.info(prefixSuccess + 'Backup deleted.')
  } else if (options.output === 'json') {
    // output.data = res
    // console.info(JSON.stringify(output, null, 2))
  }

  process.exit()
}
