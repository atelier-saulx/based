import {
  Context,
  BasedFunctionClient,
  WebSocketSession,
  HttpSession,
  Geo,
  isClientContext,
  BasedQuery,
  BasedQueryFunctionConfig,
} from '@based/functions'
import type { ActiveObservable } from './query/index.js'
import uws from '@based/uws'
import initNetwork from './incoming/index.js'
import { BasedFunctions, FunctionConfig } from './functions/index.js'
import { BasedAuth, AuthConfig } from './auth/index.js'
import { BasedErrorCode, BasedErrorData } from '@based/errors'
import { wait } from '@based/utils'
import { BasedFunctionClient as BasedServerFunctionClient } from './functionApi/index.js'
import { ActiveChannel } from './channel/index.js'
import util, { styleText } from 'node:util'
import { encodeReload } from './protocol.js'

type EventMap = {
  error: BasedErrorData | BasedErrorCode
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

type GetIp = (res: uws.HttpResponse, req: uws.HttpRequest) => string

type QueryEvents = {
  subscribe: (obs: ActiveObservable, ctx?: Context<WebSocketSession>) => void
  unsubscribe: (obs: ActiveObservable, ctx?: Context<WebSocketSession>) => void
  get: (
    obs: ActiveObservable,
    ctx?: Context<WebSocketSession | HttpSession>,
  ) => void
}

type ChannelEvents = {
  subscribe: (obs: ActiveChannel, ctx?: Context<WebSocketSession>) => void
  unsubscribe: (obs: ActiveChannel, ctx?: Context<WebSocketSession>) => void
}

export type ServerOptions = {
  clients?: { [key: string]: any }
  port?: number
  key?: string
  geo?: (ctx: Context) => Promise<Geo>
  disableRest?: boolean
  disableWs?: boolean
  silent?: boolean
  cert?: string
  functions?: FunctionConfig
  rateLimit?: RateLimit
  client?: (server: BasedServer) => BasedFunctionClient
  auth?: AuthConfig
  query?: QueryEvents
  channel?: ChannelEvents
  ws?: {
    maxBackpressureSize?: number
    open?: (client: Context<WebSocketSession>) => void
    close?: (client: Context<WebSocketSession>) => void
  }
  http?: {
    open?: (client: Context<HttpSession>) => void
    close?: (client: Context<HttpSession>) => void
  }

  getIp?: GetIp
  console?: Console
}

/**
Based server

```js
const server = new BasedServer({
  port: 9910,
  functions: {
    configs: {
      hello: {
        type: 'function',
        fn: async () => 'hello'
      },
      counter: {
        type: 'query',
        fn: () => () => {}
      }
    }
  }
})

server.functions.add({
  hello: { type: 'function', fn: async () => 'hello' }
})

server.functions.addRoutes({
  bla: { type: 'query' }
})

await server.start()
```
*/
export class BasedServer {
  public console: Console = console

  public clients: { [key: string]: any } // for now any...

  public client: BasedServerFunctionClient

  public functions: BasedFunctions

  public auth: BasedAuth

  public port: number

  public uwsApp: uws.TemplatedApp

  public silent: boolean

  public queryEvents: QueryEvents

  public channelEvents: ChannelEvents

  public rateLimit: RateLimit = {
    ws: 2e3,
    http: 1e3,
    drain: 500,
  }

  public listenSocket: any

  public forceReloadLastSeqId: number = -1

  public encodedForceReload: Uint8Array

  public sendInitialForceReload: boolean = false

  public forceReloadTimer: ReturnType<typeof setTimeout>

  // handle reconnect
  // maybe add seqId as optional version hash as well (to force same versions)
  public forceReload(type: number = 0, validTime: number = 6e3) {
    if (this.forceReloadTimer) {
      clearTimeout(this.forceReloadTimer)
    }
    this.forceReloadLastSeqId++
    if (this.forceReloadLastSeqId > 255) {
      this.forceReloadLastSeqId = 0
    }
    this.encodedForceReload = encodeReload(type, this.forceReloadLastSeqId)
    this.uwsApp.publish('reload', this.encodedForceReload, true, false)
    this.sendInitialForceReload = true

    if (validTime === 0) {
      this.sendInitialForceReload = false
    } else {
      this.forceReloadTimer = setTimeout(() => {
        this.sendInitialForceReload = false
        this.forceReloadTimer = null
      }, validTime)
    }
  }

  public geo: (ctx: Context) => Promise<Geo> = async (ctx: Context) => {
    if (!ctx.session) {
      throw new Error('Session expired while parsing geo location')
    }
    if (isClientContext(ctx)) {
      return {
        country: 'NL',
        ip: ctx.session.ip,
        accuracy: 0,
        long: 0,
        lat: 0,
        regions: [],
      }
    } else {
      throw new Error('Cannot parse geo location from a non external context')
    }
  }

  public getIp: GetIp = (res: uws.HttpResponse): string => {
    return Buffer.from(res.getRemoteAddressAsText()).toString()
  }

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

  // // Mapping... CTX ID -> normal id nessecary for unsubscribe
  // public activeCtxObservables: Map<
  //   number,
  //   { config: BasedQueryFunctionConfig['ctx']; count: number }
  // > = new Map()

  public activeObservablesById: Map<number, ActiveObservable> = new Map()

  public channelCleanTimeout: NodeJS.Timeout

  public channelCleanupCycle: number = 30e3

  public restFallbackPath: string

  public activeChannels: {
    [name: string]: Map<number, ActiveChannel>
  } = {}

  public activeChannelsById: Map<number, ActiveChannel> = new Map()

  public listeners: {
    [E in Event]?: Listener<EventMap[E]>[]
  } = {}

  public workerRequest: (type: string, payload?: any) => void | Promise<any>

  private http: ServerOptions['http'] = {};

  [util.inspect.custom]() {
    return `BasedServer [${this.port}]`
  }

  constructor(opts: ServerOptions) {
    if (opts.console) {
      this.console = opts.console
    }

    if (opts.query) {
      this.queryEvents = opts.query
    }

    if (opts.channel) {
      this.channelEvents = opts.channel
    }

    if (opts.silent) {
      this.silent = opts.silent
    }

    this.clients = opts.clients ?? {}

    if (!opts.functions) {
      opts.functions = {}
    }

    if (!opts.functions.configs) {
      opts.functions.configs = {}
    }

    this.functions = new BasedFunctions(this, opts.functions)
    this.auth = new BasedAuth(this, opts.auth)

    let restPath = '148e7ba428e4dbd'
    // '1' +
    // (~~(Math.random() * 99999999)).toString(16) +
    // (~~(Math.random() * 99999999)).toString(16)
    this.restFallbackPath = restPath

    if (opts.client) {
      // @ts-ignore - allow different ones if you want a special client
      this.client = opts.client(this)
    } else {
      this.client = new BasedServerFunctionClient(this)
    }

    if (opts.rateLimit) {
      this.rateLimit = opts.rateLimit
    }

    if (opts.geo) {
      this.geo = opts.geo
    }

    if (opts.getIp) {
      this.getIp = opts.getIp
    }

    if (opts.http?.open) {
      this.http.open = opts.http.open
    }

    if (opts.http?.close) {
      this.http.close = opts.http.close
    }

    initNetwork(this, opts)
  }

  emit(
    type: Event,
    client: Context,
    val: EventMap[Event],
    err?: Error | string,
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

  async start(port?: number, sharedSocket?: boolean): Promise<BasedServer> {
    if (!port) {
      port = this.port
    } else {
      this.port = port
    }
    await wait(10)
    return new Promise((resolve, reject) => {
      this.uwsApp.listen(this.port, sharedSocket ? 0 : 1, (listenSocket) => {
        if (listenSocket) {
          if (!this.silent)
            console.info('    Based-server listening on port:', this.port)
          this.listenSocket = listenSocket
          if (this.http?.open) {
            this.http.open({})
          }
          resolve(this)
        } else {
          console.info(
            styleText('red', '🤮  Based-server error on port:'),
            this.port,
          )
          if (this.http?.close) {
            this.http.close({})
          }
          reject(new Error('Cannot start based-server on port: ' + this.port))
        }
      })
    })
  }

  async destroy() {
    for (const name in this.functions.specs) {
      this.functions.remove(name)
    }

    if (!this.silent) {
      console.info(
        styleText('grey', `    Destroy Based-server ${this.port} \n`),
      )
    }
    if (this.listenSocket) {
      uws.us_listen_socket_close(this.listenSocket)
      this.listenSocket = null
    }
    this.listenSocket = null
    this.uwsApp = null

    if (this.http?.close) {
      this.http.close({})
    }
  }
}
