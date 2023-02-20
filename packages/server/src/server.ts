import type { Context, BasedFunctionClient } from '@based/functions'
import type { ActiveObservable } from './observable'
import uws from '@based/uws'
import initNetwork from './incoming'
import { BasedFunctions, FunctionConfig } from './functions'
import { BasedAuth, AuthConfig } from './auth'
import { BasedErrorCode, BasedErrorData } from './error'
import { wait } from '@saulx/utils'
import picocolors = require('picocolors')
import { BasedFunctionClient as BasedServerFunctionClient } from './functionApi'
import { ActiveChannel } from './channel'
import util from 'node:util'

type EventMap = {
  error: BasedErrorData
  ratelimit: void
  log: any
}

type Event = keyof EventMap

type Listener<T> = (context: Context, data?: T, err?: Error | string) => void

type RateLimit = {
  ws: number
  http: number
  drain: number
}

export type ServerOptions = {
  port?: number
  key?: string
  disableRest?: boolean
  cert?: string
  functions?: FunctionConfig
  rateLimit?: RateLimit
  client?: (server: BasedServer) => BasedFunctionClient
  auth?: AuthConfig
  ws?: {
    open: (client: Context) => void
    close: (client: Context) => void
  }
  http?: {
    open: (client: Context) => void
    close: (client: Context) => void
  }
}

// extend emitter
export class BasedServer {
  public client: BasedServerFunctionClient

  public functions: BasedFunctions

  public auth: BasedAuth

  public port: number

  public uwsApp: uws.TemplatedApp

  public rateLimit: RateLimit = {
    ws: 2e3,
    http: 1e3,
    drain: 500,
  }

  public listenSocket: any

  public blockedIps: Set<string> = new Set()

  // opposite of blockedIps can never get blocked
  public allowedIps: Set<string> = new Set()

  // per ip so consitent unfortanetly
  // check how large it is and make a loop to downgrade it
  public rateLimitCounter: Map<
    string,
    {
      requests: number
      errors?: Map<BasedErrorCode, number> // do really need this... and emit a block event
    }
  > = new Map()

  public requestsCounterInProgress: boolean = false

  public requestsCounterTimeout: NodeJS.Timeout

  public obsCleanTimeout: NodeJS.Timeout

  public obsCleanupCycle: number = 30e3

  public activeObservables: {
    [name: string]: Map<number, ActiveObservable>
  } = {}

  public activeObservablesById: Map<number, ActiveObservable> = new Map()

  public channelCleanTimeout: NodeJS.Timeout

  public channelCleanupCycle: number = 30e3

  public activeChannels: {
    [name: string]: Map<number, ActiveChannel>
  } = {}

  public activeChannelsById: Map<number, ActiveChannel> = new Map()

  public listeners: {
    [E in Event]?: Listener<EventMap[E]>[]
  } = {}

  public workerRequest: (type: string, payload?: any) => void | Promise<any>;

  [util.inspect.custom]() {
    return `BasedServer [${this.port}]`
  }

  constructor(opts: ServerOptions) {
    this.functions = new BasedFunctions(this, opts.functions)
    this.auth = new BasedAuth(this, opts.auth)
    if (opts.client) {
      // @ts-ignore - allow different ones if you want a special client
      this.client = opts.client(this)
    } else {
      this.client = new BasedServerFunctionClient(this)
    }
    if (opts.rateLimit) {
      this.rateLimit = opts.rateLimit
    }
    initNetwork(this, opts)
  }

  emit(
    type: Event,
    client: Context,
    val: EventMap[Event],
    err?: Error | string
  ) {
    if (this.listeners[type]) {
      this.listeners[type].forEach((fn) => fn(client, val, err))
    }
  }

  on(type: Event, fn: Listener<EventMap[Event]>) {
    if (!this.listeners[type]) {
      this.listeners[type] = []
    }
    this.listeners[type].push(fn)
  }

  removeAllListeners() {
    this.listeners = {}
  }

  once(type: Event, fn: Listener<EventMap[Event]>) {
    this.on(type, (v) => {
      fn(v)
      this.off(type, fn)
    })
  }

  off(type: Event, fn: Listener<EventMap[Event]>) {
    const listeners = this.listeners[type]
    if (listeners) {
      if (!fn) {
        delete this.listeners[type]
      } else {
        for (let i = 0, len = listeners.length; i < len; i++) {
          if (listeners[i] === fn) {
            listeners.splice(i, 1)
            break
          }
        }
        if (listeners.length === 0) {
          delete this.listeners[type]
        }
      }
    }
  }

  async start(
    port?: number,
    sharedSocket?: boolean,
    silent?: boolean
  ): Promise<BasedServer> {
    if (!port) {
      port = this.port
    } else {
      this.port = port
    }
    await wait(10)
    return new Promise((resolve, reject) => {
      this.uwsApp.listen(this.port, sharedSocket ? 0 : 1, (listenSocket) => {
        if (listenSocket) {
          if (!silent)
            console.info('    Based-server listening on port:', this.port)
          this.listenSocket = listenSocket
          resolve(this)
        } else {
          console.info(
            picocolors.red('🤮  Based-server error on port:'),
            this.port
          )
          reject(new Error('Cannot start based-server on port: ' + this.port))
        }
      })
    })
  }

  async destroy(silent?: boolean) {
    if (!silent) console.info(picocolors.gray('    Destroy Based-server\n'))
    if (this.listenSocket) {
      uws.us_listen_socket_close(this.listenSocket)
      this.listenSocket = null
    }
    this.listenSocket = null
    this.uwsApp = null
  }
}
