import uws from '@based/uws'
import { EventEmitter } from 'events'
import upgrade from './upgradeListener'
import message from './handlers'
import open from './openListener'
import close from './closeListener'
import Client from './Client'
import { connect, SelvaClient } from '@saulx/selva'
import { Subscription } from './handlers/subscription'
import { wait } from '@saulx/utils'
import { ServerOptions, Config } from './types'
import {
  FunctionObservable,
  SharedFunctionObservable,
} from './handlers/functions/observable'
import restHandler from './handlers/rest'
import BasedServerClient from './BasedServerClient'
import { Params } from './Params'
import { GenericObject } from '@based/client'
import { getFunction } from './getFromConfig'
import { SharedConfigurationObservable } from './handlers/configuration/observable'
const pkg = require('../package.json')

export { Params, BasedServerClient, Client as User }

export * from './types'

export class BasedServer extends EventEmitter {
  public port: number

  public uwsApp: uws.TemplatedApp

  public listenSocket: any

  public subscriptions: {
    [id: string]:
      | Subscription
      | SharedConfigurationObservable
      | SharedFunctionObservable
      | FunctionObservable
  } = {}

  public based: BasedServerClient

  // will be clients
  public clients: { [id: string]: Client } = {}

  // make this default for browser

  public db: SelvaClient

  public config: Config

  public state: GenericObject

  constructor({
    key,
    cert,
    useLessMemory,
    port,
    db,
    config,
    state,
  }: ServerOptions) {
    super()

    if (state) {
      this.state = state
    } else {
      this.state = {}
    }

    if (config?.functionConfig) {
      const interval = ~~(config.functionConfig.idleTimeout / 2)
      const clear = async () => {
        if (config.functions) {
          for (const key in config.functions) {
            // & key !== open && key !== close
            // good name ?

            // based init - will ask project env org (all optional ofc)
            if (key !== 'authorize' && !key.startsWith('event-')) {
              if (config.functions[key].cnt === 2) {
                await config.functionConfig.clear(this, key)
                delete config.functions[key]
              } else {
                if (config.functions[key].cnt !== undefined) {
                  config.functions[key].cnt++
                }
              }
            }
          }
        }
        setTimeout(clear, interval)
      }
      setTimeout(clear, interval)
    }

    if (config?.secretsConfig) {
      config.secretsConfig.secretTimeouts = {}
      const interval = ~~(config.secretsConfig.idleTimeout / 2)
      const clear = async () => {
        if (config.secrets) {
          for (const key in config.secretsConfig.secretTimeouts) {
            if (config.secretsConfig.secretTimeouts[key] === 2) {
              // await config.secretsConfig.clear(this, key)
              delete config.secretsConfig.secretTimeouts[key]
              // delete config.secrets[key]
            } else {
              if (config.secretsConfig.secretTimeouts[key] !== undefined) {
                config.secretsConfig.secretTimeouts[key]++
              }
            }
          }
        }
        setTimeout(clear, interval)
      }
      setTimeout(clear, interval)
    }

    const app =
      key && cert
        ? uws.SSLApp({
            key_file_name: key,
            cert_file_name: cert,
            ssl_prefer_low_memory_usage: useLessMemory,
          })
        : uws.App()

    if (port) {
      this.port = port
    }

    app
      .ws('/*', {
        maxPayloadLength: 1024 * 1024 * 16 * 1000, // 5mb should be more then enough
        idleTimeout: 100,
        compression: uws.SHARED_COMPRESSOR, // 1,
        upgrade: (res, req, ctx) => {
          upgrade(this, res, req, ctx)
        },
        message: (ws, msg) => {
          message(this, ws, msg)
        },
        open: (ws) => {
          open(this, ws)
        },
        close: (ws) => {
          close(this, ws)
        },
        drain: (ws) => {
          // call client.drain can be much more efficient
          if (ws.client && ws.client.backpressureQueue) {
            ws.client.drain()
          }
        },
      })
      // /with name
      .get('/*', (res, req) => restHandler(this, req, res))
      .post('/*', (res, req) => restHandler(this, req, res))
      .options('/*', (res, req) => restHandler(this, req, res))

    this.uwsApp = app
    this.db = connect(db)

    if (config) {
      const based = new BasedServerClient(
        new Params(this, {
          payload: {},
          callStack: ['server'],
        }),
        true
      )

      this.based = based
      this.on('open', (client) => {
        if (config.onOpen) {
          config.onOpen({ user: client, based })
        }
      })

      this.on('close', (client) => {
        if (config.onClose) {
          config.onClose({ user: client, based })
        }
      })
      this.config = config
    }
  }

  restartSubscription(name: string) {
    for (const id in this.subscriptions) {
      const sub = this.subscriptions[id]
      // @ts-ignore
      if (sub.name === name) {
        // @ts-ignore
        sub.restart()
      }
    }
  }

  start(port?: number): Promise<BasedServer> {
    if (!port) {
      port = this.port
    } else {
      this.port = port
    }
    return new Promise((resolve, reject) => {
      this.uwsApp.listen(this.port, (listenSocket) => {
        if (listenSocket) {
          console.info(
            `💫  Based-server ${pkg.version} listening on port:`,
            this.port
          )
          // do this better wrap a nice thing arround it
          this.listenSocket = listenSocket
          resolve(this)
        } else {
          console.info('🤮  Based-server error on port:', this.port)
          reject(new Error('Cannot start based-server on port: ' + this.port))
        }
      })
    })
  }

  async getFunction(name: string) {
    return getFunction(this, name)
  }

  async destroy() {
    console.info('🔥  Destroy based-server')
    for (const c in this.clients) {
      this.clients[c].destroy()
      delete this.clients[c]
    }

    if (this.listenSocket) {
      uws.us_listen_socket_close(this.listenSocket)
      this.listenSocket = null
    }
    this.listenSocket = null
    this.uwsApp = null
    await this.db.destroy()
    this.db = null

    await wait(1000)
  }
}

const createServer = async (props: ServerOptions): Promise<BasedServer> => {
  const basedServer = new BasedServer(props)
  return props.port ? basedServer.start() : basedServer
}

export default createServer
