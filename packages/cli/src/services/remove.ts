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
  prefixNotice,
  prefixSuccess,
  printAction,
  printEmptyLine,
  printError,
  printHeader,
} from '../tui'
import { GenericOutput } from '../types'
import { findService, FindServiceOptions } from './findService'

export type ServicesRemoveOptions = GlobalOptions & FindServiceOptions & {
  force?: boolean
}

type ServicesRemoveOutput = GenericOutput & {
  data: {
    id: string
  }[]
}

export const servicesRemoveCommand = new Command('remove')
  .description('Remove a service.')
  .option('--template <template>', 'Service template')
  .option('--name <name>', 'Name the service')
  .option('--force', 'Force remove without confirmation')
  .action(async (options) => {
    const config = await makeConfig(options)
    printHeader(options, config)
    options.output === 'fancy' && printAction('Remove service')

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

    const output: ServicesRemoveOutput = { data: [] }

    let spinner: ora.Ora

    if (
      options.output === 'none' ||
      (options.nonInteractive &&
        (!options.force || !options.name || !options.template))
    ) {
      fail(
        'template or name and force arguments must be suplied in non interactive mode.',
        output,
        options
      )
    }

    try {

      const service = await findService(client, spinner, config, output, options)

      if (!options.force) {
        printEmptyLine()
        console.info(
          prefixNotice +
            'About the remove the service' +
            chalk.blue(
              service.dist.name +
                (service.args?.name ? ` (${service.args.name})` : '')
            )
        )
        const confirm = await inquirer.prompt({
          ...inquirerConfig,
          type: 'input',
          name: 'del',
          message: `To confirm deletion enter ${chalk.red('"DELETE"')}:`,
        })
        if (confirm.del !== 'DELETE') {
          fail('Canceled.', output, options)
        }
      }

      if (options.output === 'fancy') {
        spinner = ora('Removing services').start()
      }
      const removeResult = await client.call('removeService', {
        id: service.id,
      })
      spinner && spinner.stop()
      if (removeResult.error) {
        throw new Error(removeResult.error)
      }

      output.data.push({
        id: service.id,
        name: service.args?.name,
        template: service.dist?.name,
      })

      if (options.output === 'fancy') {
        printEmptyLine()
        console.info(
          prefixSuccess +
            'Removed service ' +
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
      fail('Cannot remove service.', output, options)
    }
    process.exit(0)
  })
