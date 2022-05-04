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

type Template = {
  type: string
  name: string
  id: string
  dists: {
    commitDate: number
    commitHash: string
    createdAt: number
    id: string
    isDb: boolean
    loadPriority: string
    name: string
    protocol: string
    public: boolean
    specs: {
      cores: number
      cpu: string
      memory: string
    }
    type: string
    version: string
  }[]
}

const allowedServices = [
  '@based/db-env-default',
  '@based/db-env-read-replica',
  '@based/db-env-registry',
  '@based/db-env-sub-manager',
  '@based/db-env-sub-registry',
  '@based/hub',
  '@based/loadtest',
  '@based/db-env-analytics',
]

const coresChoices = [
  { value: 1, mane: '1 core' },
  { value: 2, mane: '2 cores' },
  { value: 4, mane: '4 cores' },
  { value: 8, mane: '8 cores' },
]

const memoryChoices = [
  { name: '1gb', value: '1g' },
  { name: '2gb', value: '2g' },
  { name: '4gb', value: '4g' },
  { name: '8gb', value: '8g' },
  { name: '16gb', value: '16g' },
]

export type ServicesAddOptions = GlobalOptions & {
  template?: string
  instances?: string
  cores?: string
  memory?: string
  name?: string
}

type ServicesAddOutput = GenericOutput & {
  data: {
    id: string
  }[]
}

export const servicesAddCommand = new Command('add')
  .description('Add a service.')
  .option('--template <template>', 'Service template')
  .option('--instances <instances>', 'Amount of instances')
  .option('--name <name>', 'Name the service')
  .addOption(
    new Option('--cores <cores>', 'Amount of cores in machine').choices(
      coresChoices.map((v) => String(v.value))
    )
  )
  .addOption(
    new Option('--memory <memory>', 'Amount of memory in machine').choices(
      memoryChoices.map((v) => String(v.name))
    )
  )
  .action(async (options: ServicesAddOptions) => {
    const config = await makeConfig(options)
    printHeader(options, config)
    options.output === 'fancy' && printAction('Add service')

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

    if (
      options.output === 'none' ||
      (options.nonInteractive &&
        (!options.template ||
          !options.instances ||
          !options.cores ||
          !options.memory))
    ) {
      fail(
        'template, isntances, cores and memory arguments must be suplied in non interactive mode.',
        output,
        options
      )
    }

    try {
      if (options.output === 'fancy') {
        spinner = ora('Getting service templates').start()
      }
      const serviceTemplates = await client.call('listServiceTemplates')
      spinner && spinner.stop()

      let template: Template
      if (options.template) {
        template = serviceTemplates
          .filter((t: Template) => allowedServices.includes(t.name))
          .find((t: Template) => t.name === options.template)
      } else {
        ;({ template } = await inquirer.prompt({
          ...inquirerConfig,
          type: 'list',
          name: 'template',
          message: 'Select service template:',
          choices: serviceTemplates
            .filter((t: Template) => allowedServices.includes(t.name))
            .map((t: Template) => ({ name: t.name, value: t })),
        }))
      }
      if (!template) {
        fail('Could not find template.', output, options)
      }

      let name: string
      if (options.name) {
        name = options.name
      } else if (!options.nonInteractive) {
        ;({ name } = await inquirer.prompt({
          ...inquirerConfig,
          type: 'input',
          name: 'name',
          message: 'What to call the service (optional) ?',
        }))
      }

      let instances: number
      if (options.instances) {
        instances = parseInt(options.instances)
      } else {
        const response = await inquirer.prompt({
          ...inquirerConfig,
          type: 'input',
          name: 'instances',
          message: 'How many instances should be created?',
          default: 1,
        })
        instances = parseInt(response.instances)
      }
      if (!instances || isNaN(instances)) {
        fail('Instances argument should be a number.', output, options)
      }

      let cores: number
      if (options.cores) {
        cores = (
          coresChoices.find(
            (choice) => choice.value === parseInt(options.cores)
          ) || {}
        ).value
      } else {
        const response = await inquirer.prompt({
          ...inquirerConfig,
          type: 'list',
          name: 'cores',
          message: 'Amount of cores in machine.',
          choices: coresChoices,
          default: '1',
        })
        cores = response.cores
      }
      if (!cores) {
        fail('cores argument is not a valid choice.', output, options)
      }

      let memory: string
      if (options.memory) {
        memory = (
          memoryChoices.find(
            (choice) => choice.name === options.memory.toLowerCase()
          ) || {}
        ).value
      } else {
        const response = await inquirer.prompt({
          ...inquirerConfig,
          type: 'list',
          name: 'memory',
          message: 'Amount of memory in machine.',
          choices: memoryChoices,
        })
        memory = response.memory
      }
      if (!memory) {
        fail('memory argument is not a valid choice.', output, options)
      }

      if (options.output === 'fancy') {
        spinner = ora('Creating service').start()
      }
      const envId = getEnvId(config.env, config.org, config.project)
      const result = await client.call('addService', {
        env: envId,
        amount: instances,
        name: template.name,
        args: name ? { name } : {},
        // TODO: select service
        dist: template.dists[0]?.id,
        specs: {
          cores,
          memory,
        },
      })
      spinner && spinner.stop()
      if (result.error) {
        throw new Error(result.error)
      }
      output.data.push({
        envId,
        env: config.env,
        project: config.project,
        org: config.org,
        message: 'Created service.',
      })
      if (options.output === 'fancy') {
        printEmptyLine()
        console.info(
          prefixSuccess +
            'Created service ' +
            chalk.blue(template.name + (name ? ` (${name})` : '')) +
            '.'
        )
      } else if (options.output === 'json') {
        console.info(JSON.stringify(output, null, 2))
      }
    } catch (error) {
      spinner && spinner.stop()
      options.debug && printError(error)
      fail('Cannot add service.', output, options)
    }
    process.exit(0)
  })
