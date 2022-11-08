import inquirer from 'inquirer'
import fs from 'fs'
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
import path from 'path'
import { ApiKeyData, ApiKeysOptions } from '.'
import { Based } from '@based/client'

type ApiKeysDownloadOutput = GenericOutput & {
  data: {
    id: string
    name: string
    token: string
  }[]
}

export const download = async ({
  client,
  options,
  config,
}: {
  client: Based
  options: ApiKeysOptions
  config: Config
}) => {
  options.output === 'fancy' && printAction('Download apiKey')

  const output: ApiKeysDownloadOutput = { data: [] }

  const orgId = getOrgId(config.org)

  if (!options.name && !options.file && options.nonInteractive) {
    fail(
      'Need to use `name` and `file` arguments in nonInteractive mode',
      output,
      options
    )
  }

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
        message: 'Select apiKey to dwonload',
        choices: apiKeys?.map((apiKey: { id: string; name: string }) => ({
          value: { id: apiKey.id, name: apiKey.name },
          name: apiKey.name,
        })),
      }))
    }

    let file: string
    if (options.file) {
      file = options.file
    } else {
      ;({ file } = await inquirer.prompt({
        ...inquirerConfig,
        type: 'input',
        name: 'file',
        message: 'Path where to save the key:',
        default: './apiKey.key',
      }))
    }
    const filePath = path.join(process.cwd(), file)

    if (options.output === 'fancy') {
      spinner = ora('Downloading apiKey').start()
    }
    const { id: downloadedId, token } = await client.get('getApiKey', { id })
    spinner && spinner.stop()

    if (options.output === 'fancy') {
      spinner = ora('Saving file').start()
    }
    await new Promise((resolve, reject) => {
      fs.writeFile(filePath, token, 'utf8', (err) => {
        if (err) {
          reject(err)
        }
        resolve(true)
      })
    })
    spinner && spinner.stop()

    output.data.push({ id: downloadedId, token, filePath })

    if (options.output === 'fancy') {
      printEmptyLine()
      console.info(prefixSuccess + `Downloaded key ${chalk.blue(name)}`)
      console.info(prefixSuccess + `to file ${chalk.blue(file)}`)
    }
  } catch (error) {
    spinner && spinner.stop()
    options.debug && printError(error)
    fail('Cannot get apiKeys', output, options)
  }

  if (options.output === 'json') {
    console.info(JSON.stringify(output, null, 2))
  }
}
