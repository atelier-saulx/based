import { program } from 'commander'
import { command, GlobalOptions } from './command'
import chalk from 'chalk'
import { join } from 'path'
import { promises as fs } from 'fs'
import based from '@based/client'
import checkAuth from './checkAuth'
import { fail, prefixSuccess, printError, printHeader } from './tui'
import { GenericOutput } from './types'
import ora from 'ora'
import { makeConfig } from './makeConfig'

type SchemaOutput = GenericOutput & {
  data: {}[]
}
type SchemaOptions = GlobalOptions & {
  file?: string
  config?: string
  db?: string
}

// also allow get
command(
  program
    .command('schema')
    .description('Db schema configuration')
    .option('-f, --file <file>', 'Config from a file (json or js)')
    .option('-C, --config <config>', 'Inline config')
    .option('--db <db>', 'Db, uses "default" if nothing is provided')
).action(async (options: SchemaOptions) => {
  const config = await makeConfig(options)

  printHeader(options, config, 'Update schema.')

  const output: SchemaOutput = { data: [] }

  if (!config.org) {
    fail('Please provide an org.', output, options)
  }

  if (!config.project) {
    fail('Please provide a project.', output, options)
  }

  if (!config.env) {
    fail('Please provide an env.', output, options)
  }

  if (!options.file && !options.config) {
    fail(
      'Config needs to point to a file (--file) or add it inline (--config)',
      output,
      options
    )
  }

  const token = await checkAuth(options)
  const s = Date.now()

  let payload: any
  if (options.file) {
    if (/\.js$/.test(options.file)) {
      const js = require(join(process.cwd(), options.file))
      payload = js.default ? js.default : js
    } else {
      try {
        const f = await fs.readFile(options.file)
        payload = JSON.parse(f.toString())
      } catch (err) {
        fail(`Cannot read file ${options.file}`, output, options)
      }
    }
  } else {
    try {
      payload = JSON.parse(options.config)
    } catch (err) {
      fail('Cannot parse inline config', output, options)
    }
  }

  if (options.db && Array.isArray(payload)) {
    fail(
      'Cannot pass array configuration and --db flag together',
      output,
      options
    )
  }

  if (payload) {
    const client = based({
      cluster: config.cluster,
      org: config.org,
      project: config.project,
      env: config.env,
    })

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

    if (options.db) {
      payload.db = options.db
    }

    let spinner: ora.Ora
    try {
      if (options.output === 'fancy') {
        spinner = ora('Updating schema').start()
      }
      await client.updateSchema(payload)
      spinner && spinner.stop()

      const isDefault = !payload.db || payload.db === 'default'

      output.data.push({
        ok: true,
        message: 'Succesfully updated schema.',
        db: payload.db,
        ms: Date.now() - s,
      })

      if (options.output === 'json') {
        console.info(JSON.stringify(output, null, 2))
      } else if (options.output === 'fancy') {
        console.info(
          prefixSuccess +
            'Succesfully updated schema on ' +
            chalk.blue(config.org + '/' + config.project + '/' + config.env) +
            (isDefault ? '' : ' for db ' + chalk.blue(payload.db)) +
            ' in ' +
            chalk.blue(Date.now() - s + 'ms')
        )
      }
    } catch (err) {
      spinner && spinner.stop()
      options.debug && printError(err)
      fail('Cannot update schema.', output, options)
    }
  }
  process.exit(0)
})
