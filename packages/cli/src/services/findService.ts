import chalk from 'chalk'
import inquirer from 'inquirer'
import { ListServicesFunctionData } from '../services/ls'
import { fail, inquirerConfig } from '../tui'
import { GlobalOptions } from '../command'
import { Based } from '@based/client'
import ora from 'ora'
import { envId as getEnvId } from '@based/ids'
import { Config } from '../types'

export type FindServiceOptions = {
  template?: string
  name?: string
}

export const findService = async (
  client: Based,
  spinner: ora.Ora,
  config: Config,
  output: any,
  options: GlobalOptions & FindServiceOptions
): Promise<ListServicesFunctionData> => {
  if (options.output === 'fancy') {
    spinner = ora('Getting services').start()
  }
  const envId = getEnvId(config.env, config.org, config.project)
  const result = await client.get('listServices', { id: envId })
  const services: ListServicesFunctionData[] = result.services
  spinner && spinner.stop()

  let service: ListServicesFunctionData
  if (options.name) {
    service = services.find((service) => service.args?.name === options.name)
    if (!service) {
      fail(
        `Service with name ${chalk.blue(options.name)} not found.`,
        output,
        options
      )
    }
  } else if (options.template) {
    service = services.find(
      (service) => service.dist?.name === options.template
    )
    if (!service) {
      fail(
        `Service from template ${chalk.blue(options.template)} not found.`,
        output,
        options
      )
    }
  } else {
    ;({ service } = await inquirer.prompt({
      ...inquirerConfig,
      type: 'list',
      name: 'service',
      message: 'Select service template:',
      choices: services.map((s) => ({
        name: s.dist?.name + (s.args?.name ? ` (${s.args.name})` : ''),
        value: s,
      })),
    }))
  }
  return service
}
