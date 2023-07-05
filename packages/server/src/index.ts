import os from 'os'
import fs from 'fs'
import { join } from 'path'
import mkdirp from 'mkdirp'

import chalk from 'chalk'
import getPort from 'get-port'

import { Options, ServerOptions } from './types'

console.info('start server!')

const resolveOpts = async (opts: Options): Promise<ServerOptions> => {
  let parsedOpts: ServerOptions
  if (typeof opts === 'function') {
    parsedOpts = await opts()
  } else {
    parsedOpts = await opts
  }
  if (!parsedOpts.port) {
    parsedOpts.port = await getPort()
  }

  if (!parsedOpts.host) {
    const network = os.networkInterfaces()
    let ip
    for (const key in network) {
      const r = network[key].find(
        (v) => v.family === 'IPv4' && v.internal === false
      )
      if (r) {
        ip = r
        break
      }
    }
    parsedOpts.host = (ip && ip.address) || '0.0.0.0'
  }

  if (!parsedOpts.dir) {
    parsedOpts.dir = join(process.cwd(), 'tmp')
  }

  // has to be mkdirp
  if (!fs.existsSync(parsedOpts.dir)) {
    await mkdirp(parsedOpts.dir)
  }

  if (parsedOpts.default) {
    parsedOpts.name = 'default'
  }

  return parsedOpts
}

const validate = (
  opts: ServerOptions,
  required: string[],
  illegal: string[]
): string | undefined => {
  for (const field of required) {
    if (!opts[field]) {
      return `${field} is required`
    }
  }

  for (const field of illegal) {
    if (opts[field]) {
      return `${field} is not a valid option`
    }
  }

  if (opts.name === 'registry') {
    return `Registry is a reserved name`
  }

  if (!opts.port) {
    return `no port provided`
  }

  if (!opts.host) {
    return `no host provided`
  }

  if (typeof opts.port !== 'number') {
    return `port is not a number ${opts.port}`
  }

  if (typeof opts.dir !== 'string') {
    return `string is not a string ${opts.dir}`
  }
}

export async function startOrigin(opts: Options): Promise<SelvaServer> {
  const parsedOpts = await resolveOpts(opts)
  const err = validate(parsedOpts, ['registry', 'name'], [])
  if (err) {
    console.error(`Error starting origin selva server ${chalk.red(err)}`)
    throw new Error(err)
  }
  if (!parsedOpts.name) {
    parsedOpts.name = 'default'
  }
  return startServer('origin', parsedOpts)
}

export async function startReplica(opts: Options) {
  const parsedOpts = await resolveOpts(opts)

  const err = validate(parsedOpts, ['registry', 'name'], ['backups'])
  if (err) {
    console.error(`Error starting replica selva server ${chalk.red(err)}`)
    throw new Error(err)
  }
  if (!parsedOpts.name && parsedOpts.default) {
    parsedOpts.name = 'default'
  }
  return startServer('replica', parsedOpts)
}

export async function startRegistry(opts: Options): Promise<SelvaServer> {
  const parsedOpts = await resolveOpts(opts)

  const err = validate(
    parsedOpts,
    [],
    ['registry', 'backups', 'name', 'default']
  )

  parsedOpts.name = 'registry'

  if (err) {
    console.error(`Error starting registry selva server ${chalk.red(err)}`)
    throw new Error(err)
  }
  return startServer('registry', parsedOpts)
}

export async function start(opts: Options) {
  const parsedOpts = await resolveOpts(opts)

  // TODO: for now all in different ports, fix later
  const err = validate(
    parsedOpts,
    [],
    ['registry', 'backups', 'name', 'default']
  )

  if (err) {
    console.error(`Error starting selva server ${chalk.red(err)}`)
    throw new Error(err)
  }

  const registry = await startServer('registry', {
    ...parsedOpts,
    name: 'registry',
  })

  const origin = await startOrigin({
    name: 'default',
    registry,
    // @ts-ignore
    dir: opts.dir,
    pipeRedisLogs: parsedOpts.pipeRedisLogs || {
      stdout: true,
      stderr: true,
    },
  })

  registry.on('close', async () => {
    // TODO: Remove comment
    await origin.destroy()
    // await timeseries.destroy()
    // await tsRegistry.destroy()
    // timeseriesPostgres.destroy() // not async
    // await timeseriesWorker.destroy()
  })

  return registry
}
