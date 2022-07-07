import chalk from 'chalk'
import { Command } from 'commander'
import inquirer from 'inquirer'
import ora from 'ora'
import { GlobalOptions } from '../command'
import { makeConfig } from '../makeConfig'
import {
  inquirerConfig,
  printAction,
  printHeader,
  fail,
  prefixSuccess,
  printError,
} from '../tui'
import { GenericOutput } from '../types'
import { gitHubDownload } from './gitHubDownload'
import { gitHubFetch, GitHubItem } from './gitHubFetch'

export type TemplatesInstallOptions = GlobalOptions & {
  name?: string
  dest?: string
}

export type TemplatesInstallOutput = GenericOutput & {
  data: {
    name: string
  }[]
}

export const templateInstallCommand = new Command('install')
  .description('Install template')
  .option('-n --name <name>', 'Name of template to install')
  .option('--dest <dest>', 'Destination to save the template')
  .action(async (options: TemplatesInstallOptions) => {
    const config = await makeConfig(options)
    printHeader(options, config)
    options.output === 'fancy' && printAction('Install template')

    const output: TemplatesInstallOutput = { data: null }

    let spinner: ora.Ora

    try {
      if (options.output === 'fancy') {
        spinner = ora('Getting templates').start()
      }
      const templatesFetchResult = (await gitHubFetch(
        '/packages/templates',
        output,
        options
      )) as GitHubItem[]
      const availableTemplates = templatesFetchResult
        .filter((r: { type: string }) => r.type === 'dir')
        .map((r: { name: string }) => r.name)
      spinner && spinner.stop()

      let template: string
      if (options.name) {
        template = availableTemplates.find((t: string) => t === options.name)
      } else {
        ;({ template } = await inquirer.prompt({
          ...inquirerConfig,
          type: 'list',
          name: 'template',
          message: 'Select template to install:',
          choices: availableTemplates,
        }))
      }
      if (!template) {
        fail('Could not find template.', output, options)
      }

      let dest: string
      if (options.dest && typeof options.dest === 'string') {
        dest = options.dest
      } else {
        const response = await inquirer.prompt({
          ...inquirerConfig,
          type: 'input',
          name: 'dest',
          message: 'Where should the template be saved?',
          default: './',
        })
        dest = response.dest
      }
      await gitHubDownload(
        `/packages/templates/${template}/functions/`,
        dest,
        output,
        options
      )

      if (options.output === 'json') {
        console.info(JSON.stringify(output, null, 2))
      } else if (options.output === 'fancy') {
        console.info(
          prefixSuccess +
            'Saved template ' +
            chalk.blue(template) +
            ' to ' +
            chalk.blue(dest) +
            '.'
        )
      }
    } catch (error) {
      spinner && spinner.stop()
      options.debug && printError(error)
      fail(
        'Issue installing template. Use --debug for more info',
        output,
        options
      )
    }
  })
