import { Command } from 'commander'
import ora from 'ora'
import { GlobalOptions } from '../command'
import { GenericOutput } from '../types'
import {
  fail,
  prefixSuccess,
  printAction,
  printError,
  printHeader,
} from '../tui'
import chalk from 'chalk'
import { makeConfig } from '../makeConfig'
import { gitHubFetch, GitHubItem } from './gitHubFetch'

export type TemplatesLsOptions = GlobalOptions & {}

type TemplatesLsOutput = GenericOutput & {
  data: {
    templates?: string[]
  }[]
}

export const templateLsCommand = new Command('ls')
  .description('List available template')
  .action(async (options: TemplatesLsOptions) => {
    const config = await makeConfig(options)
    printHeader(options, config)
    options.output === 'fancy' && printAction('List templates')

    const output: TemplatesLsOutput = { data: null }

    let spinner: ora.Ora

    try {
      if (options.output === 'fancy') {
        spinner = ora('Getting templates').start()
      }
      const result = (await gitHubFetch(
        '/packages/templates',
        output,
        options
      )) as GitHubItem[]

      const availableTemplates = result
        .filter((r: { type: string }) => r.type === 'dir')
        .map((r: { name: string }) => r.name)

      spinner && spinner.stop()
      if (options.output === 'json') {
        console.info(JSON.stringify(output, null, 2))
      } else if (options.output === 'fancy') {
        console.info(
          prefixSuccess +
            'Available templates: ' +
            chalk.blue(availableTemplates.join(', '))
        )
      }
    } catch (error) {
      spinner && spinner.stop()
      options.debug && printError(error)
      fail('Cannot get templates', output, options)
    }
  })
