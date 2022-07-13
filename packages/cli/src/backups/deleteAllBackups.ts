import { Based } from '@based/client'
import inquirer from 'inquirer'
import { fail, inquirerConfig, prefixSuccess } from '../tui'
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

export async function deleteAllBackups(
  client: Based,
  options: BackupOptions,
  config: Config
) {
  const output: BackupListOutput = { data: [] }
  let { database } = options

  if (!database) database = 'default'

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
      message: `Are you sure you want to delete all ${String(
        backups.length
      )} remote backups for the ${database} database? This action is irreversible.`,
    })

    if (!sure) {
      fail('Aborted.', output, options)
    }

    await client.call('removeAllBackups', {
      ...config,
      database,
    })

    console.info(prefixSuccess + 'Backups deleted.')
  } else if (options.output === 'json') {
    // output.data = res
    // console.info(JSON.stringify(output, null, 2))
  }

  process.exit()
}
