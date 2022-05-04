import chalk from 'chalk'
import { Command } from 'commander'
import inquirer from 'inquirer'
import ora from 'ora'
import checkAuth from '../checkAuth'
import { GlobalOptions } from '../command'
import makeClient from '../makeClient'
import { makeConfig } from '../makeConfig'
import {
  fail,
  inquirerConfig,
  prefixSuccess,
  printAction,
  printEmptyLine,
  printError,
  printHeader,
} from '../tui'
import { GenericOutput } from '../types'
import { findService, FindServiceOptions } from './findService'

export type ServicesRestartOptions = GlobalOptions & FindServiceOptions

type ServicesRestartOutput = GenericOutput & {
  data: {
    id: string
    name: string
    template: string
  }[]
}

export const servicesRestartCommand = new Command('restart')
  .description('Restart a service.')
  .option('--template <template>', 'Service template')
  .option('--name <name>', 'Name the service')
  .action(async (options) => {
    const config = await makeConfig(options)
    printHeader(options, config)
    options.output === 'fancy' && printAction('Restart service')

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

    const output: ServicesRestartOutput = { data: [] }

    let spinner: ora.Ora

    if (
      options.output === 'none' ||
      (options.nonInteractive && (!options.name || !options.template))
    ) {
      fail(
        'name or template argument must be suplied in non interactive mode.',
        output,
        options
      )
    }

    try {
      const service = await findService(
        client,
        spinner,
        config,
        output,
        options
      )

      if (options.output === 'fancy') {
        spinner = ora('Restarting service').start()
      }
      await client.call('sendEventToAllInstances', {
        id: service.id,
        type: 'restart',
      })
      spinner && spinner.stop()

      output.data.push({
        id: service.id,
        name: service.args?.name,
        template: service.dist?.name,
      })

      if (options.output === 'fancy') {
        printEmptyLine()
        console.info(
          prefixSuccess +
            'Restarted service ' +
            chalk.blue(
              service.dist?.name +
                (service.args?.name ? ` (${service.args.name})` : '')
            ) +
            '.'
        )
      } else if (options.output === 'json') {
        console.info(JSON.stringify(output, null, 2))
      }
    } catch (error) {
      spinner && spinner.stop()
      options.debug && printError(error)
      fail('Cannot restart service.', output, options)
    }
    process.exit(0)
  })
