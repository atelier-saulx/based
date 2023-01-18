import { program } from 'commander'
import { command, GlobalOptions } from './command'
import chalk from 'chalk'
import { promises as fs } from 'fs'
import checkAuth from './checkAuth'
import ora from 'ora'
import makeClient from './makeClient'
import { prettyDate } from '@based/pretty-date'
import inquirer from 'inquirer'
import { GenericOutput } from './types'
import {
  fail,
  inquirerConfig,
  padded,
  prefix,
  prefixNotice,
  prefixSuccess,
  printEmptyLine,
  printError,
  printHeader,
} from './tui'
import { stripAnsi } from './tui/stripAnsi'
import { makeConfig } from './makeConfig'

type SecretData = {
  name: string
  lastUpdated: number
}

type SecretsOutput = GenericOutput & {
  data: SecretData[] | { message: string; name?: string; org?: string }[]
}

type SecretOptions = GlobalOptions & {
  file?: string
  value?: string
  delete?: boolean
}

command(
  program
    .command('secrets')
    .argument('[name]', 'Name of the secret')
    .description('Secrets api - if no name lists secrets')
    .option('-f, --file <file>', 'Add secret from a file')
    .option('-v, --value <value>', 'Add secret value inline')
    .option('-D, --delete', 'Remove a secret from an organisation')
).action(async (name: string, options: SecretOptions) => {
  const config = await makeConfig(options)
  printHeader(options, config, 'Manage secrets')

  const output: SecretsOutput = { data: [] }

  let isLs = false

  if (!name && !options.delete) {
    isLs = true
  }

  const token = await checkAuth(options)
  const s = Date.now()

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

  let spinner: ora.Ora
  if (!config.org) {
    try {
      if (options.output === 'fancy') {
        spinner = ora('Getting orgs').start()
      }
      const { orgs } = await client.get('listOrgs')
      spinner && spinner.stop()

      if (orgs.length === 1) {
        config.org = orgs[0].name
      } else {
        if (orgs.length === 0) {
          fail('Cannot find orgs', output, options)
        }
        const x = await inquirer.prompt({
          ...inquirerConfig,
          type: 'list',
          name: 'org',
          message: 'Select organization',
          choices: orgs.map((v: any) => v.name),
        })
        if (x.org) {
          config.org = x.org
        }
      }
    } catch (err) {
      spinner && spinner.stop()
      options.debug && printError(err)
      fail('Cannot find any organizations for this account', output, options)
    }

    if (!config.org) {
      fail('Please provide an org', output, options)
    }
  }

  if (!(options.value || options.file) && !isLs && !options.delete) {
    fail('Please provide a file or value', output, options)
  }

  if (isLs) {
    if (options.output === 'fancy') {
      spinner = ora('Getting secrets').start()
    }
    try {
      const { secrets } = await client.get('listSecrets', {
        org: config.org,
        name,
        secret: null,
      })
      spinner && spinner.stop()

      secrets.forEach((secret: { name: string; lastUpdated: number }) => {
        const { name, lastUpdated } = secret
        output.data.push({ name, lastUpdated })
      })

      if (options.output === 'json') {
        console.info(JSON.stringify(output, null, 2))
      } else if (options.output === 'fancy') {
        printOutput(output)
      }
    } catch (err) {
      spinner && spinner.stop()
      options.debug && printError(err)
      fail('Cannot read secrets', output, options)
    }
  } else if (options.delete) {
    if (options.output === 'fancy') {
      spinner = ora('Deleting secret').start()
    }

    try {
      await client.call('updateSecret', {
        org: config.org,
        name,
        delete: true,
      })
      spinner && spinner.stop()
      output.data.push({
        message: 'Succesfully removed secret.',
        name,
        org: config.org,
      })
      if (options.output === 'json') {
        console.info(JSON.stringify(output, null, 2))
      } else if (options.output === 'fancy') {
        console.info(
          prefixSuccess +
            'Succesfully removed secret ' +
            chalk.blue(name) +
            ' from ' +
            chalk.blue(config.org)
        )
      }
    } catch (err) {
      spinner && spinner.stop()
      options.debug && printError(err)
      fail('Cannot remove secret', output, options)
    }
  } else {
    if (options.output === 'fancy') {
      spinner = ora('Updating secret').start()
    }

    let value: string = options.value
    if (options.file) {
      try {
        value = (await fs.readFile(options.file))
          .toString()
          .replace(/^[\r\n]+|\.|[\r\n]+$/gm, '')
      } catch (err) {
        spinner && spinner.stop()
        options.debug && printError(err)
        fail(
          `Cannot read secret from ${chalk.blue(options.file)}`,
          output,
          options
        )
      }
    }

    try {
      await client.call('updateSecret', {
        org: config.org,
        name,
        value,
      })
      spinner && spinner.stop()

      output.data.push({
        message: 'Succesfully updated secret',
        name,
        org: config.org,
      })
      if (options.output === 'json') {
        console.info(JSON.stringify(output, null, 2))
      } else if (options.output === 'fancy') {
        console.info(
          prefixSuccess +
            'Succesfully updated secret ' +
            chalk.blue(name) +
            ' to ' +
            chalk.blue(config.org)
        )
        console.info(prefix + chalk.gray('in ' + (Date.now() - s) + 'ms'))
      }
    } catch (err) {
      spinner && spinner.stop()
      options.debug && printError(err)
      fail('Cannot update secret', output, options)
    }
  }

  process.exit(0)
})

const printOutput = (output: SecretsOutput) => {
  if (!output.data.length) {
    console.info(prefixNotice + 'No secrets found.')
    return
  }

  const colSpacing = 2
  const nameHeader = 'name'
  const lastUpdatedHeader = 'updated'
  const nameColLength =
    Math.max(
      ...output.data
        .map((item: SecretData) => item.name.length)
        .concat(nameHeader.length)
    ) + colSpacing
  const lastUpdatedColLength =
    Math.max(
      ...output.data
        .map(
          (item: SecretData) =>
            stripAnsi(prettyDate(item.lastUpdated, 'date-time-human')).length
        )
        .concat(nameHeader.length)
    ) + colSpacing

  console.info(
    prefix +
      padded(nameHeader, nameColLength, chalk.gray) +
      padded(lastUpdatedHeader, lastUpdatedColLength, chalk.gray)
  )
  output.data.forEach((item: SecretData) => {
    console.info(
      prefix +
        padded(item.name, nameColLength, chalk.blue) +
        padded(
          prettyDate(item.lastUpdated, 'date-time-human'),
          lastUpdatedColLength
        )
    )
  })
  output.data.length > 1 && printEmptyLine()
}
