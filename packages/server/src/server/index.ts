type ServerType = 'registry' | 'origin' | 'replica'
type ServerDescriptor = {
  name: string
  host: string
  port: number
  type: ServerType
}

import { ServerOptions } from '../types'
import { EventEmitter } from 'events'
import chalk from 'chalk'

import { spawn, ChildProcess } from 'child_process'
import path from 'path'

export class SelvaServer extends EventEmitter {
  public pm: ChildProcess
  public type: ServerType
  public port: number
  public host: string
  public name: string
  public origin: ServerDescriptor
  private backupDir: string

  constructor(serverType: ServerType) {
    super()
    this.setMaxListeners(10000)
    this.type = serverType

    this.on('error', () => {
      // console.error(err)
    })

    // beforeExit.do(() => {
    //   return this.destroy()
    // })
  }

  async start(opts: ServerOptions) {
    if (this.pm) {
      return
    }

    this.port = opts.port
    this.name = opts.name

    this.backupDir = opts.dir

    const execPath = path.join(
      __dirname,
      '..',
      '..',
      '..',
      '..',
      'selvad',
      'selvad'
    )

    this.pm = spawn(execPath, [], {
      env: {
        ...process.env,
        ...{
          SELVA_MALLOC_CONF:
            'prof:true,prof_active:true,prof_leak:true,lg_prof_interval:30,lg_prof_sample:17,prof_prefix:jeprof.out',
          LOCPATH: path.join(
            execPath,
            '..',
            'binaries',
            'Linux_x86_64',
            'locale'
          ),
          SELVA_PORT: String(this.port),
          SERVER_SO_REUSE: '1',
          SELVA_REPLICATION_MODE: '1',
          AUTO_SAVE_INTERVAL: '1200',
        },
      },
      stdio: 'inherit',
    })
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
    console.info('Got SIGINT, closing redis server')
    if (server.pm) {
      server.pm.kill('SIGINT')
    }

    setTimeout(() => {
      console.info('Exiting after graceful shutdown')
      process.exit(0)
    }, 1e3 * 4).unref()
  })
  process.on('SIGTERM', () => {
    console.info('Got SIGTERM, closing redis server')
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
    process.exit(0)
  })
}

export const startServer = async (
  type: ServerType,
  opts: ServerOptions
): Promise<SelvaServer> => {
  const server = new SelvaServer(type)
  await server.start(opts)

  // add singnal handlers in selva itself to close redis
  console.log('ADDING SIGNAL HANDLERS')
  addSignalHandlers(server)

  return server
}
