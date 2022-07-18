import { program } from 'commander'
import fs from 'fs/promises'
import { command, GlobalOptions } from '../command'
import chalk from 'chalk'
import ora from 'ora'
import { build } from 'esbuild'
import checkAuth from '../checkAuth'
import makeClient from '../makeClient'
import { envId } from '@based/ids'
import path from 'path'
import { Based } from '@based/client'
import { GenericOutput } from '../types'
import {
  fail,
  prefix,
  printAction,
  inquirerConfig,
  printEmptyLine,
  prefixSuccess,
  printHeader,
  prefixWarn,
  prefixError,
} from '../tui'
import inquirer from 'inquirer'
import { makeConfig } from '../makeConfig'

import { BasedFunctionConfig, findSchemaAndFunctions } from './finder'
import { hash } from '@saulx/hash'
import deployFunctions from './deployFunctions'
import updateSchema from './updateSchema'

type DeployOutput = GenericOutput & {
  data: {
    email: string
  }[]
}

export type DeployOptions = {
  file: string[]
  schema: boolean
  functions: boolean
  name: string[]
  bundle: boolean
} & GlobalOptions

export const output: DeployOutput = { data: [] }
let unchangedFns = 0

command(
  program
    .command('deploy')
    .description('Deploy a full application')
    .option('-f, --file  [files...]', 'Load schema from file/s')
    .option('--schema', 'Deploy schema')
    .option('--functions', 'Deploy functions')
    .option('-n, --name  [names...]', 'Deploy functions by name/s')
    .option('--no-bundle', "Don't bundle the functions before deploying")
).action(async (options: DeployOptions) => {
  const config = await makeConfig(options)

  printHeader(options, config)
  if (options.output !== 'json') {
    printAction('Deploying environment and/or schema')
  }

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

  const envid = envId(config.env, config.org, config.project)

  let found: { schemaFiles: string[]; fns: BasedFunctionConfig[] }
  try {
    found = await findSchemaAndFunctions(options)
  } catch (err) {
    fail(err.message, output, options)
  }

  if (options.name) {
    const filteredFunctions = []
    options.name.forEach((requestedName) => {
      const functionToAdd = found.fns?.find((fn) => fn.name === requestedName)
      if (functionToAdd) {
        filteredFunctions.push(functionToAdd)
      } else {
        console.info(
          prefixError + "Can't find function " + chalk.blue(requestedName)
        )
      }
    })
    found.fns = filteredFunctions
  }

  const { schemaFiles, fns } = found

  if (schemaFiles.length > 1) {
    fail(`More than one schema file found, aborting.`, output, options)
  }

  // check double names
  const dup = hasDuplicate(fns.map((el) => el.name))
  if (dup) {
    fail(`Multiple definitions for function called ${dup}`, output, options)
  }

  // Build functions
  if (found.fns?.length) {
    const d = Date.now()
    const spinner = ora(`Building function(s)...`)
    spinner.start()
    await Promise.all(
      fns.map(async (fun) => {
        if (options.bundle) {
          const x = await build({
            bundle: true,
            outdir: 'out',
            incremental: false,
            publicPath: '/',
            target: 'node14',
            entryPoints: [fun.path],
            minify: true,
            platform: 'node',
            write: false,
          })
          fun.code = x.outputFiles[0].text
        } else {
          fun.code = await fs.readFile(fun.path, 'utf8')
          fun.fromFile = false
        }
        fun.status = await compareRemoteFns(client, envid, fun.code, fun.name)
        if (fun.status === 'unchanged') {
          unchangedFns++
        }
        if (fun.status === 'err')
          throw new Error("Error checking function's remote version")
      })
    ).catch((err) => fail(err.message, output, options))
    spinner.stop()
    console.info(
      chalk.grey(prefixSuccess + `Function(s) built in ${Date.now() - d}ms`)
    )

    let maxPathLength: number = null
    let maxNameLength: number = null
    fns.forEach((value) => {
      const { path: funcFilePath, name } = value
      const tmp = path.join('./', path.relative('./', funcFilePath))
      maxPathLength = maxPathLength < tmp.length ? tmp.length : maxPathLength
      maxNameLength = maxNameLength < name.length ? name.length : maxNameLength
    })
    if (fns.length > unchangedFns) {
      console.info(
        prefix +
          chalk.bold.cyanBright(
            'name'.padEnd(maxNameLength, ' '),
            prefix,
            'observable',
            prefix,
            'shared',
            prefix,
            'status'.padEnd('update'.length),
            prefix,
            'path'
          )
      )

      fns.forEach((value) => {
        const { path: funcFilePath, name, observable, shared, status } = value
        if (status !== 'unchanged') {
          const relativeFnPath = './' + path.relative('./', funcFilePath)
          console.info(
            prefix + chalk.greenBright(name.padEnd(maxNameLength)),
            prefix,
            chalk.bold.greenBright(
              observable
                ? '✔'.padEnd('Observable'.length)
                : ''.padEnd('Observable'.length)
            ),
            prefix,
            chalk.bold.greenBright(
              shared ? '✔'.padEnd('Shared'.length) : ''.padEnd('Shared'.length)
            ),
            prefix,
            chalk.blue(status.padEnd('update'.length)),
            prefix,
            chalk.blue(relativeFnPath)
          )
        }
      })

      if (unchangedFns > 0)
        console.info(prefixWarn + `and ${unchangedFns} unchanged function(s).`)
    } else {
      console.info(
        prefixWarn +
          `All ${fns.length} functions found were unchanged compared to their remote versions.`
      )
    }
  }

  printEmptyLine()

  if (schemaFiles.length) {
    console.info(
      chalk.bold(
        prefix +
          `Schema at path ` +
          chalk.cyan(`${'./' + path.relative('./', schemaFiles[0])}`)
      )
    )
  } else {
    if (!options.functions && !options.name?.length) {
      console.info(chalk.bold(prefix + 'No schema found'))
    }
  }

  printEmptyLine()

  const actionsList = ['schema', 'functions', 'both'] as const
  let action: typeof actionsList[number] // uses array above as possible values

  if (options.schema && (options.functions || options.name?.length)) {
    action = 'both'
  } else if (options.schema) {
    action = 'schema'
  } else if (options.functions || options.name?.length) {
    action = 'functions'
  } else {
    ;({ action } = await inquirer.prompt([
      {
        ...inquirerConfig,
        type: 'list',
        name: 'action',
        message: 'What would you like to deploy? (Ctrl+C to abort)',
        choices: actionsList,
      },
    ]))
  }

  if (action === 'schema' || action === 'both') {
    await updateSchema(config, schemaFiles, options)
  }
  if (action === 'functions' || action === 'both') {
    await deployFunctions(client, envid, config, fns, unchangedFns)
  }

  process.exit()
})

function hasDuplicate(arr: any[]) {
  let result = false
  for (let i = 0; i < arr.length; i++) {
    if (arr.indexOf(arr[i]) !== arr.lastIndexOf(arr[i])) {
      result = arr[i]
      break
    }
  }
  return result
}

async function compareRemoteFns(
  client: Based,
  envid: string,
  code: string,
  name: string
): Promise<'update' | 'new' | 'unchanged' | 'err'> {
  const version = hash(code).toString(16)
  const id = await client.id('function', name + envid)
  const remote = await client.get({
    $id: id,
    current: true,
  })

  if (remote.$isNull) return 'new'
  if (remote.current === version) return 'unchanged'
  if (remote.current !== version) return 'update'
  return 'err'
}
