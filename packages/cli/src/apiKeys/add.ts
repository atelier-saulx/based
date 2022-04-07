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
import { Based } from '@based/client'
import { ApiKeysOptions } from '.'
import path from 'path'

type ApiKeysAddOutput = GenericOutput & {
  data: {
    id: string
  }[]
}

export const add = async ({
  client,
  options,
  config,
}: {
  client: Based
  options: ApiKeysOptions
  config: Config
}) => {
  options.output === 'fancy' && printAction('Add apiKey')

  const output: ApiKeysAddOutput = { data: [] }

  let name: string
  if (options.name) {
    name = options.name
  } else {
    ;({ name } = await inquirer.prompt({
      ...inquirerConfig,
      type: 'input',
      name: 'name',
      message: 'What is the apiKey name?',
    }))
  }

  const orgId = getOrgId(config.org)

  let spinner: ora.Ora
  try {
    if (options.output === 'fancy') {
      spinner = ora('Adding apiKey').start()
    }
    const { id, token } = await client.call('updateApiKey', { name, orgId })
    spinner && spinner.stop()

    if (options.file) {
      const filePath = path.join(process.cwd(), options.file)
      await new Promise((resolve, reject) => {
        fs.writeFile(filePath, token, 'utf8', (err) => {
          if (err) {
            reject(err)
          }
          resolve(true)
        })
      })
    }
    // TODO: save to file

    output.data.push({ id, name })

    if (options.output === 'fancy') {
      printEmptyLine()
      console.info(prefixSuccess + `Added key ${chalk.blue(name)}`)
    }
  } catch (error) {
    spinner && spinner.stop()
    options.debug && printError(error)
    if (/apiKey already exists/gm.test(error.message)) {
      fail(`apiKey ${chalk.blue(name)} already exists`, output, options)
    }
    fail('Cannot get apiKeys', output, options)
  }

  if (options.output === 'json') {
    console.info(JSON.stringify(output, null, 2))
  }
}
