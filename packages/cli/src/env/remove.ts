import ora from 'ora'
import chalk from 'chalk'
import inquirer from 'inquirer'
import {
  fail,
  inquirerConfig,
  prefixError,
  prefixNotice,
  prefixSuccess,
  prefixWarn,
  printAction,
  printEmptyLine,
  printError,
} from '../tui'
import { Based } from '@based/client'
import { GlobalOptions } from '../command'
import { Config, GenericOutput } from '../types'

type EnvsRemoveOutput = GenericOutput & {
  data: {
    org: string
    project: string
    env: string
  }[]
}

export const remove = async ({
  client,
  options,
  config,
}: {
  client: Based
  options: GlobalOptions
  config: Config
}) => {
  // can also select an env
  // config
  // if (!project )

  // from config you take them

  const output: EnvsRemoveOutput = { data: [] }
  options.output === 'fancy' && printAction('Remove an environment')
  let spinner: ora.Ora

  if (options.env && options.project && options.org && options.nonInteractive) {
    if (options.output === 'fancy') {
      spinner = ora('Removing environment').start()
    }

    await client.call('removeEnv', {
      org: options.org,
      env: options.env,
      project: options.project,
    })

    spinner && spinner.stop()
  } else {
    let fromConfig: { env: string; project: string; org: string }
    if (config.env && config.project && config.org) {
      fromConfig = {
        env: config.env,
        project: config.project,
        org: config.org,
      }
    }

    try {
      const envs = await client.call('listEnvs')
      if (envs.length === 1) {
        config.env = envs[0]
      } else {
        if (envs.length === 0) {
          fail('Cannot find envs', output, options)
        }
        const x = await inquirer.prompt({
          ...inquirerConfig,
          type: 'list',
          name: 'env',
          message: 'Select environment to remove',
          choices: (fromConfig
            ? envs.sort((a, b) => {
                if (
                  a.org === fromConfig.org &&
                  a.env === fromConfig.env &&
                  a.project === fromConfig.project
                ) {
                  return -1
                }
                return 1
              })
            : envs
          ).map((v) => ({
            value: v,
            name: v.org + '/' + v.project + '/' + v.env,
          })),
        })

        let envSelected

        if (x.env) {
          envSelected = x.env
        }

        if (!envSelected) {
          throw new Error('No env selected')
        }

        printEmptyLine()
        console.info(prefixNotice + 'About the remove the environment')
        console.info(
          prefixNotice +
            `${chalk.blue(
              `${envSelected.org}/${envSelected.project}/${envSelected.env}`
            )} with ${chalk.blue(envSelected.serviceInstances.length)} machines`
        )
        const xx = await inquirer.prompt({
          ...inquirerConfig,
          type: 'input',
          name: 'del',
          message: `To confirm deletion enter ${chalk.red('"DELETE"')}:`,
        })

        if (xx.del === 'DELETE') {
          spinner = ora('Removing environment').start()
          await new Promise((resolve) => setTimeout(resolve, 2e3))
          await client.call('removeEnv', {
            org: envSelected.org,
            env: envSelected.env,
            project: envSelected.project,
          })
          spinner.clear()

          printEmptyLine()
          console.info(
            prefixSuccess +
              'Succesfully removed environment ' +
              chalk.blue(
                `${envSelected.org}/${envSelected.project}/${envSelected.env}`
              )
          )
        } else {
          printEmptyLine()
          console.info(prefixWarn + 'Removal aborted')
        }
        process.exit()
      }
    } catch (err) {
      console.info(
        prefixError + chalk.red('No env selected or no env defined for account')
      )
      options.debug && printError(err)
      process.exit()
    }
  }
}
