import { join } from 'path'
import { writeJson, pathExists } from 'fs-extra'
import chalk from 'chalk'
import ora from 'ora'
import inquirer from 'inquirer'
import {
  fail,
  inquirerConfig,
  prefix,
  prefixSuccess,
  printAction,
  printEmptyLine,
  printError,
} from '../tui'
import { Config, GenericOutput } from '../types'
import { Based } from '@based/client'
import { GlobalOptions } from '../command'
import { envId as getEnvId } from '@based/ids'

type EnvsAddOutput = GenericOutput & {
  data: {
    org: string
    project: string
    env: string
  }[]
}

export const add = async ({
  client,
  options,
  config,
}: {
  client: Based
  options: GlobalOptions
  config: Config
}) => {
  options.output === 'fancy' && printAction('Create environment')

  const output: EnvsAddOutput = { data: [] }
  if (options?.nonInteractive && (!config.project || !config.env)) {
    fail(
      '`project` and `env` argument must be provided in non interactive mode.',
      output,
      options
    )
  }

  let spinner: ora.Ora
  try {
    // dont use based config...

    if (options.project && options.org && options.env) {
      // make this env
    } else if (!options.org) {
      try {
        const { orgs } = await client.get('listOrgs')
        if (orgs.length === 1) {
          config.org = orgs[0].name
          options.output === 'fancy' &&
            console.info(prefix + chalk.bold('Org: ') + chalk.blue(config.org))
        } else {
          if (orgs.length === 0) {
            throw new Error('Cannot find orgs')
          }
          if (options.nonInteractive) {
            fail(
              'More than one org found. It must be provided as an argument in non interactive mode',
              output,
              options
            )
          }
          const x = await inquirer.prompt({
            ...inquirerConfig,
            type: 'list',
            name: 'org',
            message:
              'For which organisation do you want to create an environment?',
            choices: orgs.map((v: any) => v.name),
            ...(config?.org ? { default: config.org } : null),
          })
          if (x.org) {
            config.org = x.org
          }
        }
      } catch (err) {
        fail('Cannot find any organisations for this account', output, options)
      }
    }

    if (!options.project) {
      // fill in a default from config

      const x = await inquirer.prompt({
        ...inquirerConfig,
        type: 'input',
        name: 'project',
        message: 'What is the project name?',
        ...(config?.project ? { default: config.project } : null),
      })
      config.project = x.project
    }

    if (!options.env) {
      // fill in a default from config

      const x = await inquirer.prompt({
        ...inquirerConfig,
        type: 'input',
        name: 'env',
        message: `Provide an environment key ${chalk.grey(
          'e.g. "dev", "production"'
        )}:`,
        ...(config?.env ? { default: config.env } : null),
      })
      config.env = x.env
    }

    // flag to not have inputs
    if (!options.basedFile && !options.nonInteractive) {
      const bFile = join(process.cwd(), 'based.json')

      // do you want to overwrite file
      const exists = await pathExists(bFile)

      exists && console.info(prefix + `Based file exists: ${chalk.grey(bFile)}`)
      const x = await inquirer.prompt({
        ...inquirerConfig,
        type: 'confirm',
        name: 'makebasedjson',
        message: exists
          ? `Do you want to update it to ${chalk.blue(
              config.org + '/' + config.project + '/' + config.env
            )}?`
          : `Do you want to create a based file for "${config.org}/${
              config.project
            }/${config.env}"? ${chalk.grey(bFile)}`,
      })

      if (x.makebasedjson) {
        await writeJson(bFile, {
          env: config.env,
          org: config.org,
          project: config.project,
          ...(config.cluster ? { cluster: config.cluster } : null),
        })
      }
    }

    if (options.output === 'fancy') {
      spinner = ora(
        `Creating environment ${chalk.blue(config.org)} ${chalk.blue(
          config.project
        )} ${chalk.blue(config.env)}`
      ).start()
    }

    const envObj = {
      org: config.org,
      project: config.project,
      env: config.env,
    }

    if (!envObj.org || !envObj.project || !envObj.env) {
      fail('No full env', output, options)
    }

    await client.call('createEnv', {
      env: envObj,
    })

    // spinner.text = 'Environment created starting machines'

    const envId = getEnvId(envObj.env, envObj.org, envObj.project)
    await new Promise((resolve, reject) => {
      let close: any
      // close needs to be there as first
      // make something to make this very easy to do
      // await client.until({}, d => d// is)
      client
        .observe(
          {
            $id: envId,
            machines: {
              id: true,
              status: true,
              serviceInstances: {
                $list: {
                  $find: {
                    $traverse: 'children',
                    $filter: [
                      {
                        $operator: '=',
                        $field: 'type',
                        $value: 'serviceInstance',
                      },
                    ],
                  },
                },
                status: true,
                id: true,
              },
              $list: {
                $find: {
                  $traverse: 'children',
                  $filter: [
                    {
                      $operator: '=',
                      $field: 'type',
                      $value: 'machine',
                    },
                  ],
                },
              },
            },
          },
          (d) => {
            let rdy = 0

            for (const machine of d.machines) {
              if (machine.status === 1) {
                rdy++
              }
            }

            if (spinner) {
              spinner.text = `Deploying services ${rdy}/${d.machines.length}`
            }

            if (rdy === d.machines.length) {
              spinner && spinner.clear()
              if (close) {
                close()
              }
              resolve(undefined)
            }
          },
          (err) => console.info(err)
        )
        .then((c) => {
          close = c
        })
        .catch((err: Error) => {
          console.error(err)
          reject(err)
        })
    })

    output.data.push(envObj)
    if (options.output === 'fancy') {
      printEmptyLine()
      console.info(
        prefixSuccess +
          `Succesfully created environment ${chalk.blue(
            `${envObj.org}/${envObj.project}/${envObj.env}`
          )}`
      )
    }
  } catch (err) {
    spinner && spinner.clear()
    options.debug && printError(err)
    if (err.code === 'exists') {
      fail(
        `Cannot create environment, ${chalk.blue(
          config.org + '/' + config.project + '/' + config.env
        )} already exists`,
        output,
        options
      )
    } else {
      fail('Cannot create environment', output, options)
    }
  }
}
