import { program } from 'commander'
import { command, GlobalOptions } from './command'
import { build as esbuild } from 'esbuild'
import { envId } from '@based/ids'
import prettyBytes from 'pretty-bytes'
import chalk from 'chalk'
import ora from 'ora'
import checkAuth from './checkAuth'
import makeClient from './makeClient'
import { GenericOutput } from './types'
import {
  fail,
  prefix,
  prefixError,
  prefixSuccess,
  prefixWarn,
  printEmptyLine,
  printError,
  printHeader,
} from './tui'
import { makeConfig } from './makeConfig'

// add auto updater
// and add version

type FunctionsOutput = GenericOutput & {
  data: {}[]
}

type FunctionsOptions = GlobalOptions & {
  observable?: boolean
  noSharing?: boolean
  file?: string
  delete?: boolean
  code?: string
}

const printBytes = (str: string) => {
  const size = Buffer.byteLength(str, 'utf8')
  console.info(prefix + chalk.grey(`Function is ${prettyBytes(size)}`))
}

command(
  program
    .command('functions <name>')
    .description('Functions api')
    .option('-o, --observable', 'Observable function')
    .option(
      '-S, --no-sharing',
      'Do not share the observable, useful for user bound functions'
    )
    .option('-f, --file <file>', 'Build function from a file')
    .option('-D, --delete', 'Delete function')
    .option('-c, --code <code>', 'Inline code')
).action(async (name: string, options: FunctionsOptions) => {
  const config = await makeConfig(options)
  printHeader(options, config, 'Manage functions')

  console.info(
    prefixWarn +
      '`functions` command is deprecated and will be removed soon. Please use `deploy` command instead.'
  )

  const output: FunctionsOutput = { data: [] }

  if (!name) {
    fail('Please provide a function name.', output, options)
  }

  if (!config.org) {
    fail('Please provide an org.', output, options)
  }

  if (!config.project) {
    fail('Please provide a project.', output, options)
  }

  if (!config.env) {
    fail('Please provide an env.', output, options)
  }

  if (!options.file && !options.code && !options.delete) {
    fail(
      'A function needs to point to a file (--file) or code (--code)',
      output,
      options
    )
  }

  const token = await checkAuth(options)
  const s = Date.now()

  const client = makeClient(config.cluster)

  try {
    await client.auth(token)
  } catch (error) {
    fail(error, { data: [] }, options)
  }

  const envid = envId(config.env, config.org, config.project)

  if (options.delete) {
    const spinner = ora('Deleting function').start()
    const d = Date.now()
    try {
      await client.call('deleteFunction', {
        env: envid,
        name,
      })
      spinner.stop()

      output.data.push({
        ok: true,
        message: 'Deleted function.',
        name,
        ms: Date.now() - d,
      })

      if (options.output === 'json') {
        console.info(JSON.stringify(output, null, 2))
      } else {
        console.info(
          prefixSuccess +
            'Deleted function ' +
            chalk.blue(name) +
            ' in ' +
            chalk.blue(Date.now() - d + 'ms')
        )
      }
      process.exit(0)
    } catch (err) {
      spinner.stop()
      const message = 'Cannot delete function.'
      output.errors = output.errors || []
      output.errors.push({ message })
      if (options.output === 'json') {
        console.info(JSON.stringify(output, null, 2))
      } else {
        console.info(prefixError + message)
      }
      options.debug && printError(err)
      process.exit(1)
    }
  } else if (options.file) {
    const d = Date.now()
    const spinner = ora('Bundling function').start()

    const result = await esbuild({
      bundle: true,
      outdir: 'out',
      incremental: false,
      publicPath: '/',
      target: 'node14',
      entryPoints: [options.file],
      minify: true,
      platform: 'node',
      write: false,
    }).catch((err) => err)

    if (result.errors && result.errors.length) {
      spinner.stop()
      options.debug && printError(result.errors)
      fail('Cannot deploy function got a build error.', output, options)
    }

    options.code = result.outputFiles[0].text

    spinner.clear()

    console.info(
      prefix + 'Build finished in ' + chalk.blue(Date.now() - d + 'ms')
    )
  }

  printBytes(options.code)
  const spinner = ora('Deploying function').start()
  try {
    await client.call('updateFunction', {
      env: envid,
      observable: options.observable,
      // TODO: command is --no-sharing. does this work?
      shared: !options.noSharing,
      name,
      code: options.code,
      fromFile: !!options.file,
    })
    spinner.clear()

    output.data.push({
      ok: true,
      message: 'Succesfully deployed function.',
      name,
      ms: Date.now() - s,
    })

    if (options.output === 'json') {
      console.info(JSON.stringify(output, null, 2))
    } else {
      printEmptyLine()
      console.info(
        prefixSuccess + 'Succesfully deployed function ' + chalk.blue(name)
      )
      console.info(
        prefixSuccess +
          'to ' +
          chalk.blue(config.org + '/' + config.project + '/' + config.env) +
          ' in ' +
          chalk.blue(Date.now() - s + 'ms')
      )
    }
    process.exit(0)
  } catch (err) {
    spinner.stop()
    const message = 'Cannot deploy function.'
    output.errors = output.errors || []
    output.errors.push({ message })
    if (options.output === 'json') {
      console.info(JSON.stringify(output, null, 2))
    } else {
      console.info(prefixError + message)
    }
    options.debug && printError(err)
    process.exit(1)
  }
})
