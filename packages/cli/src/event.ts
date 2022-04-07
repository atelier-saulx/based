import { program } from 'commander'
import { command } from './command'
import { build as esbuild } from 'esbuild'
import { envId } from '@based/ids'
import findConfig from './findConfig'
import prettyBytes from 'pretty-bytes'
import chalk from 'chalk'
import ora from 'ora'
import checkAuth from './checkAuth'
import makeClient from './makeClient'

// add auto updater
// and add version

const printBytes = (str: string) => {
  const size = Buffer.byteLength(str, 'utf8')
  console.info(chalk.grey(`Function is ${prettyBytes(size)}`))
}

command(
  program
    .command('events <name>')
    .description('Events api, supported events "open", "close"')
    .option('-f, --file <file>', 'Build event handler from a file')
    .option('-c, --code <code>', 'Inline code')
).action(async (name, options) => {
  let {
    project,
    org,
    env,
    cluster,
    file,
    observable,
    sharing,
    code,
    basedFile,
  } = options

  const config = (await findConfig(basedFile)) || {}

  if (!cluster) {
    if (config.cluster) {
      cluster = config.cluster
    }
  }

  let incomplete = false

  if (!name) {
    console.info(
      chalk.red(
        'Please provide an event name, supported events are "open", "close"'
      )
    )
    incomplete = true
  }

  if (!(name === 'open' || name === 'close')) {
    console.info(
      chalk.red(
        'Please provide a valid event name, supported events are "open", "close"'
      )
    )
    incomplete = true
  }

  if (!org) {
    if (config.org) {
      org = config.org
    } else {
      console.info(chalk.red('Please provide an org'))
      incomplete = true
    }
  }

  if (!project) {
    if (config.project) {
      project = config.project
    } else {
      console.info(chalk.red('Please provide a project'))
      incomplete = true
    }
  }

  if (!env) {
    if (config.env) {
      env = config.env
    } else {
      console.info(chalk.red('Please provide an env'))
      incomplete = true
    }
  }

  if (!file && !code) {
    console.info(
      chalk.red('An event needs to point to a file (--file) or code (--code)')
    )
    incomplete = true
  }

  if (incomplete) {
    return
  }

  const token = await checkAuth(options)
  const s = Date.now()

  const client = makeClient(cluster)
  client.auth(token)

  let payloadName = ''

  if (name === 'open') {
    payloadName = 'event-connection-open'
  } else if (name === 'close') {
    payloadName = 'event-connection-close'
  }

  // make this a pkg
  const envid = envId(env, org, project)

  if (file) {
    const d = Date.now()
    const spinner = ora('Building event handler').start()

    const result = await esbuild({
      bundle: true,
      outdir: 'out',
      incremental: false,
      publicPath: '/',
      target: 'node14',
      entryPoints: [file],
      minify: true,
      platform: 'node',
      write: false,
    }).catch((err) => err)

    if (result.errors && result.errors.length) {
      spinner.clear()

      console.info(chalk.red('Cannot deploy event handler got a build error'))

      process.exit()
      return
    }

    // @ts-ignore
    code = result.outputFiles[0].text

    spinner.clear()

    console.info(chalk.grey(`Build finished in ${Date.now() - d}ms`))
  }

  printBytes(code)
  const spinner = ora('Deploying event').start()
  try {
    await client.call('updateFunction', {
      env: envid,
      observable,
      shared: sharing,
      name: payloadName,
      code,
      fromFile: !!file,
    })
    spinner.clear()

    console.info('')
    console.info(
      `${chalk.blue('🚀 Succesfully deployed event handler')} ${chalk.white(
        name
      )} ${chalk.blue('to')} ${chalk.white(`${project}/${env}`)} ${chalk.blue(
        'in ' + (Date.now() - s) + 'ms'
      )}`
    )
  } catch (err) {
    spinner.clear()
    console.info(chalk.red('Cannot deploy event handler'), err.message)
  }

  process.exit()
})
