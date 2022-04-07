import { program } from 'commander'
import { command } from './command'
import findConfig from './findConfig'
import chalk from 'chalk'
import ora from 'ora'
import { build } from 'esbuild'
import checkAuth from './checkAuth'
import makeClient from './makeClient'
import { envId } from '@based/ids'
import { walk } from '@root/walk'
import fs from 'fs-extra'
import path from 'path'
import glob from 'glob'
import based from '@based/client'
import { GenericOutput } from './types'
import {
  fail,
  printBasedCliLogoWithVersion,
  printConfig,
  prefix,
  printAction,
  prefixError,
  inquirerConfig,
  printEmptyLine,
  prefixSuccess,
} from './tui'
import inquirer from 'inquirer'
/* 
add support for a schema files called based.schema.js, with a 
syntax like
module.exports = {
  schema: {
    *myshinynewschema*
  }
}
*/
type DeployOutput = GenericOutput & {
  data: {
    email: string
  }[]
}

command(
  program.command('deploy').description('Deploy a full application')
).action(async (options) => {
  let { project, org, env, cluster, basedFile } = options
  const output: DeployOutput = { data: [] }

  const config = (await findConfig(basedFile)) || {}

  if (!cluster) {
    if (config.cluster) {
      cluster = config.cluster
    }
  }
  if (!org) {
    if (config.org) {
      org = config.org
    } else {
      fail('Please provide an org', output, options)
    }
  }

  if (!project) {
    if (config.project) {
      project = config.project
    } else {
      fail('Please provide a project', output, options)
    }
  }

  if (!env) {
    if (config.env) {
      env = config.env
    } else {
      fail('Please provide an env', output, options)
    }
  }
  // @ts-ignore
  printBasedCliLogoWithVersion(program._version)
  printConfig(config)
  options.output !== 'json' && printAction('Deploying functions and schema')

  const token = await checkAuth(options)
  const client = makeClient(cluster)
  client.auth(token)
  const envid = envId(env, org, project)

  const functionList: Array<{
    funcFilePath: string
    config: { name: string; observable: boolean; shared: boolean }
    code
  }> = []

  let schemaList = []

  await walk('./', async (err, pathname, dirent) => {
    // walk through all subdirs, find index.js/.ts files
    // also do some error checking
    const funcConfigPath = path.resolve(path.join(pathname, 'based.config.js'))
    // const schemaPath = path.resolve(path.join(pathname, 'based.schema.js'))
    const schemaFiles = ['based.schema.js', 'based.schema.json']

    // find schema file and check for doubles
    if (dirent.isDirectory()) {
      schemaFiles.forEach((value) => {
        schemaList.push(glob.sync(`${path.resolve(pathname)}/${value}`))
      })
      schemaList = schemaList.flat()
    }

    // find index files
    const indexFiles = ['index.js', 'index.ts']
    if (dirent.isDirectory() && fs.pathExistsSync(funcConfigPath)) {
      let indexesFound = []
      indexFiles.forEach((value) => {
        indexesFound.push(glob.sync(`${path.resolve(pathname)}/${value}`))
      })
      indexesFound = indexesFound.flat()

      try {
        const basedConfig: {
          name: string
          observable: boolean
          shared: boolean
        } = require(funcConfigPath)
        if (!('name' in basedConfig) || !('observable' in basedConfig)) {
          fail(
            `Missing property in config file at ./${pathname}.\nMust have 'name' and 'observable'`,
            output,
            options
          )
        }
        if (indexesFound.length > 1) {
          fail(
            `Multiple index files for function at ./${pathname}`,
            output,
            options
          )
        }
        if (indexesFound.length < 1) {
          fail(
            `No index file found for function at ./${pathname}`,
            output,
            options
          )
        }
        functionList.push({
          funcFilePath: indexesFound[0],
          config: basedConfig,
          code: null,
        })
      } catch (e) {
        output.errors = output.errors || []
        output.errors.push({ message: e.message })
        fail(`Error when requiring ${funcConfigPath}`, output, options)
      }
    }
    if (err) throw err
  })

  if (schemaList.length > 1) {
    fail(`More than one schema file found, aborting.`, output, options)
  }

  if (functionList.length < 1) {
    fail('No functions found', output, options)
  }

  // check double names
  const dup = hasDuplicate(functionList.map((el) => el.config.name))
  if (dup) {
    fail(`Multiple definitions for function called ${dup}`, output, options)
  }

  let maxPathLength: number = null
  let maxNameLength: number = null
  functionList.forEach((value) => {
    const { funcFilePath, config } = value
    const tmp = path.join('./', path.relative('./', funcFilePath))
    maxPathLength = maxPathLength < tmp.length ? tmp.length : maxPathLength
    maxNameLength =
      maxNameLength < config.name.length ? config.name.length : maxNameLength
  })
  console.info(
    prefix +
      chalk.bold.cyanBright(
        'name'.padEnd(maxNameLength, ' '),
        prefix,
        'observable',
        prefix,
        'shared',
        prefix,
        'path'
      )
  )

  functionList.forEach((value) => {
    const {
      funcFilePath,
      config: { name, observable, shared },
    } = value
    const tmp = './' + path.relative('./', funcFilePath)
    console.info(
      prefix + chalk.greenBright(name.padEnd(maxNameLength)),
      prefix,
      chalk.magenta(
        observable
          ? 'yes'.padEnd('Observable'.length)
          : 'no'.padEnd('Observable'.length)
      ),
      prefix,
      chalk.yellow(
        shared ? 'yes'.padEnd('Shared'.length) : 'no'.padEnd('Shared'.length)
      ),
      prefix,
      chalk.blue(tmp)
    )
  })
  printEmptyLine()

  if (schemaList.length)
    console.info(
      chalk.bold.blueBright(
        prefix +
          `Schema at path ` +
          chalk.cyan(`${'./' + path.relative('./', schemaList[0])}`)
      )
    )

  printEmptyLine()

  const yes = await inquirer.prompt([
    {
      ...inquirerConfig,
      type: 'confirm',
      name: 'proceed',
      message: 'Are you sure you want to proceed?',
    },
  ])
  // const yes = await confirm(prefixInput + 'Proceed?')
  if (!yes.proceed) fail('Aborted.', output, options)
  // Build functions
  const d = Date.now()
  let spinner = ora(`Building function(s)...`)
  spinner.start()
  await Promise.all(
    functionList.map(async (fun) => {
      const x = await build({
        bundle: true,
        outdir: 'out',
        incremental: false,
        publicPath: '/',
        target: 'node14',
        entryPoints: [fun.funcFilePath],
        minify: true,
        platform: 'node',
        write: false,
      })
      fun.code = x.outputFiles[0].text
    })
  ).catch((err) => fail(err.message, output, options))
  spinner.stop()
  console.info(
    chalk.grey(prefixSuccess + `Function(s) built in ${Date.now() - d}ms`)
  )
  printEmptyLine()

  // Deploy schema
  const s = Date.now()
  if (schemaList.length) {
    const opts = {
      cluster,
      org,
      project,
      env,
    }

    const client = based(opts)
    let payload
    if (/\.js$/.test(schemaList[0])) {
      // .js
      const js = require(schemaList[0])
      payload = js.default ? js.default : js
    } else {
      // .json
      try {
        const f = await fs.readFile(schemaList[0])
        payload = JSON.parse(f.toString())
      } catch (err) {
        fail(`Cannot parse schema file`, output, options)
      }
    }

    try {
      await client.updateSchema(payload)

      const isDefault = !payload.db || payload.db === 'default'

      console.info(
        `${prefixSuccess + 'Succesfully updated schema on'} ${chalk.blue(
          `${project}/${env}`
        )}${
          isDefault ? '' : `${' for db '}${chalk.blue(payload.db)}`
        } ${chalk.grey('in ' + (Date.now() - s) + 'ms')}`
      )
    } catch (err) {
      fail('Cannot update schema' + err.message, output, options)
    }
  }
  printEmptyLine()
  // Deploy functions
  spinner = ora('Deploying function(s)...').start()
  await Promise.all(
    functionList.map(async (el) => {
      try {
        await client.call('updateFunction', {
          env: envid,
          observable: el.config.observable,
          shared: el.config.shared,
          name: el.config.name,
          code: el.code,
          fromFile: true,
        })

        spinner.stop()

        // console.info('')
        console.info(
          prefixSuccess +
            `${'Succesfully deployed function'} ${chalk.blue(
              el.config.name
            )} ${'to'} ${chalk.blue(`${project}/${env}`)} ${chalk.grey(
              'in ' + (Date.now() - s) + 'ms'
            )}`
        )
      } catch (err) {
        spinner.stop()
        console.info(
          prefixError + chalk.red('Cannot deploy function'),
          err.message
        )
      }
    })
  )

  process.exit()
})

function hasDuplicate(arr: any[]) {
  let result = false
  for (let i = 0; i < arr.length; i++) {
    // compare the first and last index of an element
    if (arr.indexOf(arr[i]) !== arr.lastIndexOf(arr[i])) {
      result = arr[i]
      // terminate the loop
      break
    }
  }
  return result
}
