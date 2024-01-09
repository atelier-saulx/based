import fs from 'fs'
import { join } from 'path'
import mkdirp from 'mkdirp'
import chalk from 'chalk'
import { Options, ServerOptions } from './types.js'
import { SelvaServer, startServer } from './server/index.js'

export { SelvaServer }

const resolveOpts = async (opts: Options): Promise<ServerOptions> => {
  let parsedOpts: ServerOptions
  if (typeof opts === 'function') {
    parsedOpts = await opts()
  } else {
    parsedOpts = await opts
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

  if (!opts.port) {
    return `no port provided`
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
  const err = validate(parsedOpts, ['name'], [])
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

  const err = validate(parsedOpts, ['name'], ['backups'])
  if (err) {
    console.error(`Error starting replica selva server ${chalk.red(err)}`)
    throw new Error(err)
  }
  if (!parsedOpts.name && parsedOpts.default) {
    parsedOpts.name = 'default'
  }
  return startServer('replica', parsedOpts)
}

export async function start(opts: Options) {
  const parsedOpts = await resolveOpts(opts)

  // TODO: for now all in different ports, fix later
  const err = validate(parsedOpts, [], ['backups', 'name', 'default'])

  if (err) {
    console.error(`Error starting selva server ${chalk.red(err)}`)
    throw new Error(err)
  }

  const origin = await startOrigin({
    name: 'default',
    dir: parsedOpts.dir,
    save: parsedOpts.save,
    port: parsedOpts.port,
  })

  // TODO: sub manager

  return origin
}
