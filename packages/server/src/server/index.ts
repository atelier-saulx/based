type ServerType = 'origin' | 'replica'

type ServerDescriptor = {
  name: string
  host: string
  port: number
  type: ServerType
}

import { ServerOptions } from '../types.js'
import { EventEmitter } from 'events'
import { spawn, ChildProcess } from 'child_process'
import path from 'path'
import { mkdirSync, existsSync } from 'fs'
import node_modules from 'node_modules-path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(
  fileURLToPath(import.meta.url).replace('/dist/', '/')
)

export class SelvaServer extends EventEmitter {
  public pm: ChildProcess
  public type: ServerType
  public port: number
  public name: string
  public origin: ServerDescriptor
  public backupDir: string
  public saveInterval: number = 0

  constructor(serverType: ServerType) {
    super()
    this.setMaxListeners(10000)
    this.type = serverType

    this.on('error', (err) => {
      console.error(err)
    })
  }

  async start(opts: ServerOptions) {
    if (this.pm) {
      return
    }

    this.port = opts.port
    this.name = opts.name

    this.backupDir = opts.dir
    if (opts.save) {
      this.saveInterval = opts.save === true ? 60 : opts.save.seconds
    }

    if (this.backupDir) {
      mkdirSync(this.backupDir, { recursive: true })
    }

    const localBuild = existsSync(
      path.join(__dirname, '..', '..', 'selvad', 'local')
    )

    let binaryPath = localBuild
      ? path.join(__dirname, '..', '..', 'selvad', 'local', 'selvad')
      : path.join(
          node_modules(),
          '@based',
          `db-server-${process.platform}-${process.arch}`,
          'bin',
          'selvad'
        )

    const env = {
      ...process.env,
      ...{
        LOCPATH: path.join(binaryPath, '..', 'locale'),
        ...(opts.ldLibraryPath
          ? {
              LD_LIBRARY_PATH: opts.ldLibraryPath,
            }
          : null),
        SELVA_PORT: String(this.port),
        SERVER_SO_REUSE: '1',
        SELVA_REPLICATION_MODE: this.type == 'replica' ? '2' : '1',
        AUTO_SAVE_INTERVAL: String(this.saveInterval),
        SAVE_AT_EXIT: opts.save ? '1' : '0',
      },
      ...opts.env,
    }

    if (opts.ldExecutablePath) {
      console.log('--------- ldExecutablePath:', opts.ldExecutablePath, env)
      this.pm = spawn(opts.ldExecutablePath, [binaryPath], {
        env,
        cwd: this.backupDir ?? process.cwd(),
        stdio: opts.stdio || 'inherit',
      })
    } else {
      console.log('--------- straight to binary:', opts.ldExecutablePath, env)
      this.pm = spawn(binaryPath, [], {
        env,
        cwd: this.backupDir ?? process.cwd(),
        stdio: opts.stdio || 'inherit',
      })
    }
  }

  async destroy() {
    if (this.pm) {
      this.pm.kill('SIGTERM')
      this.pm = undefined
    }
  }
}

function addSignalHandlers(server: SelvaServer): void {
  process.setMaxListeners(10e4)

  process.on('SIGINT', () => {
    console.info('Got SIGINT, closing selvad server')
    if (server.pm) {
      server.pm.kill('SIGINT')
    }

    setTimeout(() => {
      console.info('Exiting after graceful shutdown')
      process.exit(0)
    }, 1e3 * 4).unref()
  })
  process.on('SIGTERM', () => {
    console.info('Got SIGTERM, closing selvad server')
    if (server.pm) {
      server.pm.kill('SIGTERM')
    }

    setTimeout(() => {
      console.info('Exiting after graceful shutdown')
      process.exit(0)
    }, 1e3 * 4).unref()
  })
  process.on('exit', (code) => {
    console.info('Process exiting with code', code)
    server.destroy()
    process.exit(code)
  })
}

export const startServer = async (
  type: ServerType,
  opts: ServerOptions
): Promise<SelvaServer> => {
  const server = new SelvaServer(type)
  await server.start(opts)

  // add signal handlers in selva itself to close selvad
  console.log('ADDING SIGNAL HANDLERS')
  addSignalHandlers(server)

  return server
}
