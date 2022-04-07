import { envId as getEnvId } from '@based/ids'
import chalk from 'chalk'
import { Command } from 'commander'
import ora from 'ora'
import checkAuth from '../checkAuth'
import { GlobalOptions } from '../command'
import makeClient from '../makeClient'
import { makeConfig } from '../makeConfig'
import {
  fail,
  padded,
  prefix,
  printAction,
  printEmptyLine,
  printError,
  printHeader,
} from '../tui'
import { GenericOutput, ServiceData } from '../types'

export type ListServicesFunctionData = ServiceData

type ServicesLsData = {
  id: string
  template: string
  name: string
  instances: number
}
type ServicesLsOutput = GenericOutput & {
  data: ServicesLsData[]
}

export const servicesLsCommand = new Command('ls')
  .description('List services.')
  .action(async (options: GlobalOptions) => {
    const config = await makeConfig(options)
    printHeader(options, config)
    options.output === 'fancy' && printAction('List services')

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

    const output: ServicesLsOutput = { data: [] }

    let spinner: ora.Ora

    try {
      if (options.output === 'fancy') {
        spinner = ora('Getting services').start()
      }
      const envId = getEnvId(config.env, config.org, config.project)
      const { services } =
        (await client.get('listServices', { id: envId })) || []
      spinner && spinner.stop()
      services.forEach((service: ListServicesFunctionData) => {
        output.data.push({
          template: service.dist.name,
          name: service.args?.name,
          instances: service.amount,
          id: service.id,
        })
      })
      if (options.output === 'json') {
        console.info(JSON.stringify(output, null, 2))
      } else if (options.output === 'fancy') {
        printOutput(output)
      }
    } catch (error) {
      spinner && spinner.stop()
      options.debug && printError(error)
      fail('Cannot get services', output, options)
    }
    process.exit(0)
  })

const printOutput = (output: ServicesLsOutput) => {
  if (!output.data.length) return

  const colSpacing = 2
  const templateHeader = 'template'
  const templateColLength =
    Math.max(
      ...output.data
        .map((item: ServicesLsData) => item.template.length)
        .concat(templateHeader.length)
    ) + colSpacing
  const nameHeader = 'name'
  const nameColLength =
    Math.max(
      ...output.data
        .filter((item: ServicesLsData) => item.name)
        .map((item: ServicesLsData) => item.name.length)
        .concat(nameHeader.length)
    ) + colSpacing
  const instancesHeader = 'instances'
  const instancesColLength =
    Math.max(
      ...output.data
        .map((item: ServicesLsData) => String(item.instances).length)
        .concat(instancesHeader.length)
    ) + colSpacing

  console.info(
    prefix +
      padded(templateHeader, templateColLength, chalk.gray) +
      padded(nameHeader, nameColLength, chalk.gray) +
      padded(instancesHeader, instancesColLength, chalk.gray)
  )
  output.data.forEach((item: ServicesLsData) => {
    console.info(
      prefix +
        padded(item.template, templateColLength, chalk.blue) +
        padded(item.name, nameColLength) +
        padded(String(item.instances), instancesColLength)
    )
  })
  output.data.length > 1 && printEmptyLine()
}
