import { envId as getEnvId } from '@based/ids'
import chalk from 'chalk'
import { Command, Option } from 'commander'
import inquirer from 'inquirer'
import ora from 'ora'
import checkAuth from '../checkAuth'
import { GlobalOptions } from '../command'
import makeClient from '../makeClient'
import { makeConfig } from '../makeConfig'
import {
  fail,
  inquirerConfig,
  prefixSuccess,
  printAction,
  printEmptyLine,
  printError,
  printHeader,
} from '../tui'
import { GenericOutput } from '../types'

export type ServicesWaitOptions = GlobalOptions & {}

type ServicesAddOutput = GenericOutput & {
  data: {
    id: string
  }[]
}

export const servicesWaitCommand = new Command('wait')
  .description('Wait for all services to be ready.')
  .action(async (options: ServicesWaitOptions) => {
    const config = await makeConfig(options)
    printHeader(options, config)
    options.output === 'fancy' && printAction('Wait for services')

    const token = await checkAuth(options)
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

    const output: ServicesAddOutput = { data: [] }

    let spinner: ora.Ora

    const message = 'Waiting for services to be ready.'
    try {
      const envId = getEnvId(config.env, config.org, config.project)
      if (options.output === 'fancy') {
        spinner = ora(message).start()
      }
      await new Promise((resolve, reject) => {
        client
          .observe(
            {
              $id: envId,
              id: true,
              services: {
                $list: {
                  $find: {
                    $traverse: 'children',
                    $filter: {
                      $operator: '=',
                      $field: 'type',
                      $value: 'service',
                    },
                  },
                },
                id: true,
                serviceInstances: {
                  $list: {
                    $find: {
                      // Jim: do we need descentants here or children?
                      $traverse: 'descendants',
                      $filter: {
                        $operator: '=',
                        $field: 'type',
                        $value: 'serviceInstance',
                      },
                    },
                  },
                  id: true,
                  status: true,
                },
              },
            },
            (env) => {
              const numberOfServices = env.services.length
              const readyServices = env.services.filter(
                (service: { serviceInstances: { status: number }[] }) =>
                  service.serviceInstances.every((serviceInstance) => {
                    return serviceInstance.status === 1
                  })
              )
              if (options.output === 'fancy') {
                spinner.text =
                  message + ` ${readyServices.length}/${numberOfServices}`
              }
              if (readyServices.length === numberOfServices) {
                resolve(true)
              }
            }
          )
          .catch((err) => {
            reject(err)
          })
      })
      spinner && spinner.stop()
    } catch (error) {
      spinner && spinner.stop()
      options.debug && printError(error)
      fail('Cannot add service.', output, options)
    }
    process.exit(0)
  })
