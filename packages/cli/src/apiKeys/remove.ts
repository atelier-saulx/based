import inquirer from 'inquirer'
import {
  fail,
  inquirerConfig,
  prefixSuccess,
  printAction,
  printEmptyLine,
  printError,
} from '../tui'
import { Config, GenericOutput } from '../types'
import { orgId as getOrgId } from '@based/ids'
import ora from 'ora'
import chalk from 'chalk'
import { ApiKeyData, ApiKeysOptions } from '.'
import { Based } from '@based/client'

type ApiKeysRemoveOutput = GenericOutput & {
  data: {
    id: string
  }[]
}

export const remove = async ({
  client,
  options,
  config,
}: {
  client: Based
  options: ApiKeysOptions
  config: Config
}) => {
  options.output === 'fancy' && printAction('Remove apiKey')

  const output: ApiKeysRemoveOutput = { data: [] }

  const orgId = getOrgId(config.org)

  let spinner: ora.Ora
  try {
    if (options.output === 'fancy') {
      spinner = ora('Getting apiKeys').start()
    }
    const { apiKeys } = await client.get('listApiKeys', {
      orgId,
    })
    spinner && spinner.stop()

    let id: string
    let name: string
    if (options.name) {
      name = options.name
      ;({ id } =
        apiKeys?.find((k: ApiKeyData) => k.name === options.name) || {})
      if (!id) {
        fail(`apiKey with name ${chalk.blue(name)} not found`, output, options)
      }
    } else {
      ;({
        apiKey: { id, name },
      } = await inquirer.prompt({
        ...inquirerConfig,
        type: 'list',
        name: 'apiKey',
        message: 'Select apiKey to remove',
        choices: apiKeys?.map((apiKey: { id: string; name: string }) => ({
          value: { id: apiKey.id, name: apiKey.name },
          name: apiKey.name,
        })),
      }))
    }

    if (options.output === 'fancy') {
      spinner = ora('Removing apiKey').start()
    }
    const { id: removedId } = await client.call('removeApiKey', { id })
    spinner && spinner.stop()

    output.data.push({ id: removedId })

    if (options.output === 'json') {
      console.info(JSON.stringify(output, null, 2))
    } else if (options.output === 'fancy') {
      printEmptyLine()
      console.info(prefixSuccess + `Removed key ${chalk.blue(name)}`)
    }
  } catch (error) {
    spinner && spinner.stop()
    options.debug && printError(error)
    fail('Cannot get apiKeys', output, options)
  }
}
