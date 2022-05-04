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

export type ServicesScaleOptions = GlobalOptions &
  FindServiceOptions & {
    instances?: number
  }

type ServicesScaleOutput = GenericOutput & {
  data: {
    id: string
    name: string
    template: string
    instances: string
  }[]
}

export const servicesScaleCommand = new Command('scale')
  .description('Remove a service.')
  .option('--template <template>', 'Service template')
  .option('--name <name>', 'Name the service')
  .option('--instances <instances>', 'Amount of instances')
  .action(async (options) => {
    const config = await makeConfig(options)
    printHeader(options, config)
    options.output === 'fancy' && printAction('Scale service')

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

    const output: ServicesScaleOutput = { data: [] }

    let spinner: ora.Ora

    if (
      options.output === 'none' ||
      (options.nonInteractive && !options.instances)
    ) {
      fail(
        'name or template and instances argument must be suplied in non interactive mode.',
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

      let instances: number
      if (options.instances) {
        instances = parseInt(options.instances)
        if (isNaN(instances)) {
          fail('instances argument should be a number', output, options)
        }
      } else {
        const response = await inquirer.prompt({
          ...inquirerConfig,
          type: 'input',
          name: 'instances',
          message: 'How many instances should should the service be scaled to?',
          default: 1,
        })
        instances = parseInt(response.instances)
      }

      if (options.output === 'fancy') {
        spinner = ora('Scaling service').start()
      }
      await client.call('scaleService', {
        id: service.id,
        amount: instances,
      })
      spinner && spinner.stop()

      output.data.push({
        id: service.id,
        name: service.args?.name,
        template: service.dist?.name,
        instances,
      })

      if (options.output === 'fancy') {
        printEmptyLine()
        console.info(
          prefixSuccess +
            'Scales service ' +
            chalk.blue(
              service.dist?.name +
                (service.args?.name ? ` (${service.args.name})` : '')
            ) +
            ' to ' +
            chalk.blue(instances) +
            ' instances.'
        )
      } else if (options.output === 'json') {
        console.info(JSON.stringify(output, null, 2))
      }
    } catch (error) {
      spinner && spinner.stop()
      options.debug && printError(error)
      fail('Cannot scale service.', output, options)
    }
    process.exit(0)
  })
