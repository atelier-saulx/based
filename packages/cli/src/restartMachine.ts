import { program } from 'commander'
import { command, GlobalOptions } from './command'
import { envId } from '@based/ids'
import * as readline from 'readline'

// import inquirer from 'inquirer'
import chalk from 'chalk'
// import ora from 'ora'
import checkAuth from './checkAuth'
import makeClient from './makeClient'
import { makeConfig } from './makeConfig'
import { fail, printHeader } from './tui'
import { GenericOutput } from './types'

type RestartMachineOutput = GenericOutput & {
  data: {}[]
}
type RestartMachineOptions = GlobalOptions & {
  database?: string
  remoteBackup?: boolean
}

command(program.command('restart'))
  .option('--database <name>')
  .option(
    '--remote-backup',
    '❗️ DANGER ❗️ Restart the database instance discarding all local changes and reverting to the latest local backup'
  )
  .action(async (options: RestartMachineOptions) => {
    // let { org, project, env, cluster, basedFile, database, remoteBackup } =
    //   options
    const config = await makeConfig(options)
    printHeader(options, config, 'Restart machine')

    const output: RestartMachineOutput = { data: [] }

    if (!config.org) {
      fail('Please provide an org', output, options)
    }

    if (!config.project) {
      fail('Please provide a project', output, options)
    }

    if (!config.env) {
      fail('Please provide an env', output, options)
    }

    const token = await checkAuth(options)
    const client = makeClient(config.cluster)
    try {
      if (options.apiKey) {
        await client.auth(token, { isApiKey: true })
      } else {
        await client.auth(token)
      }
    } catch (error) {
      fail(error, { data: [] }, options)
    }

    const envid = envId(config.env, config.org, config.project)

    const { instances } = await client.get({
      $id: envid,
      instances: {
        id: true,
        machine: {
          id: true,
          $find: {
            $traverse: 'parents',
            $filter: {
              $operator: '=',
              $field: 'type',
              $value: 'machine',
            },
          },
        },
        service: {
          dbName: {
            $field: 'args.name',
          },
          $find: {
            $traverse: 'parents',
            $filter: {
              $operator: '=',
              $field: 'type',
              $value: 'service',
            },
          },
        },
        $list: {
          $find: {
            $traverse: 'descendants',
            $filter: [
              {
                $operator: '=',
                $field: 'type',
                $value: 'serviceInstance',
              },
              {
                $operator: '=',
                $field: 'name',
                $value: '@based/db-env-default',
              },
            ],
          },
        },
      },
    })

    if (!instances || instances.length < 1) {
      fail(`Couldn't find any db instance`, output, options)
    }

    const target: any = {}
    if (options.database) {
      for (const i of instances) {
        if (i.service?.dbName === options.database) {
          target.si = i.id
          target.ma = i.machine.id
        }
      }
    } else {
      for (const i of instances) {
        if (!('dbName' in i.service)) {
          target.si = i.id
          target.ma = i.machine.id
        }
      }
    }

    if (!target.ma) {
      fail(
        'Could not find the right machine, maybe wrong name?',
        output,
        options
      )
    }

    if (options.remoteBackup) {
      const yes = await confirm(
        '‼️  This will revert the database to its last online update, losing all local changes. Are you sure?'
      )
      if (!yes) {
        console.info('Aborting')
        process.exit()
      }

      await client.call('sendEventToInstance', {
        type: 'restart-no-dump',
        id: target.si,
        machineId: target.ma,
      })

      console.info('Request sent.')
    } else {
      await client.call('sendEventToInstance', {
        type: 'restart',
        id: target.si,
        machineId: target.ma,
      })
      console.info('Request sent.')
    }

    process.exit()
  })

async function confirm(message: string): Promise<boolean> {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  })
  const answer = await new Promise((resolve, reject) => {
    rl.question(chalk.red(`${message} (y/N)`), resolve)
  })
  if (
    answer !== 'y' &&
    answer !== 'yes' &&
    answer !== 'Y' &&
    answer !== 'YES'
  ) {
    return false
  } else return true
}
