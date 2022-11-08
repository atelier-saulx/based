import { Command } from 'commander'
import { BackupOptions } from '.'
import checkAuth from '../checkAuth'
import makeClient from '../makeClient'
import { makeConfig } from '../makeConfig'
import { fail, prefixSuccess, printHeader } from '../tui'
import { GenericOutput } from '../types'

export const backupMakeCommand = new Command('make')
  .description('Make new remote backup')
  .option(
    '-db --database <name>',
    "Name of the database, defaults to 'default'"
  )
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

    process.exit(0)
  })

// export async function makeBackup(
//   client: Based,
//   options: BackupOptions,
//   config: Config
// ) {
//   Object.assign(options, config)
//   const res = await client.call('makeBackup', options).catch((err) => {
//     let errorMessage = 'Could not request backup'
//     if (err.code === 'ENOMACHINE')
//       errorMessage = 'No machine found, does the database exist?'
//     else if (err.code === 'ENOINSTANCE')
//       errorMessage = 'No service instance found, does the environment exist?'
//     fail(errorMessage, { data: [], errors: [err] }, options)
//   })

//   if (res.machine) {
//     if (options.output === 'fancy') {
//       console.info(
//         prefixSuccess +
//           `Requested backup to machine ${res.machine} for database "${
//             options.database || 'default'
//           }"`
//       )
//     } else if (options.output === 'json') {
//       const output: GenericOutput = {
//         data: {
//           success: true,
//           machine: res.machine,
//         },
//       }
//       console.info(JSON.stringify(output, null, 2))
//     }
//   }
// }
