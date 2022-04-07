import { Based } from '@based/client'
import { BackupOptions } from '.'
import { fail, prefixSuccess } from '../tui'
import { Config, GenericOutput } from '../types'

export async function makeBackup(
  client: Based,
  options: BackupOptions,
  config: Config
) {
  Object.assign(options, config)
  const res = await client.call('makeBackup', options).catch((err) => {
    let errorMessage = 'Could not request backup'
    if (err.code === 'ENOMACHINE')
      errorMessage = 'No machine found, does the database exist?'
    else if (err.code === 'ENOINSTANCE')
      errorMessage = 'No service instance found, does the environment exist?'
    fail(errorMessage, { data: [], errors: [err] }, options)
  })

  if (res.machine) {
    if (options.output === 'fancy') {
      console.info(
        prefixSuccess +
          `Requested backup to machine ${res.machine} for database "${
            options.database || 'default'
          }"`
      )
    } else if (options.output === 'json') {
      const output: GenericOutput = {
        data: {
          success: true,
          machine: res.machine,
        },
      }
      console.info(JSON.stringify(output, null, 2))
    }
  }
}
