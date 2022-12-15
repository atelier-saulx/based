import type { ClientContext, ObservableCache } from '../types'
import uws from '@based/uws'
import { wait } from '@saulx/utils'
import { Worker } from 'node:worker_threads'
import { attachNetwork } from './network'
import { BasedFunctions, FunctionConfig } from './functions'
import { Listener, EventMap, Event } from './types'
import { BasedAuth, AuthConfig } from './auth'
import { BasedErrorCode } from '../error'
import { createWorker } from './worker'

export type ServerOptions = {
  port?: number
  httpPort?: number // seperate http listener
  key?: string
  cert?: string
  functions?: FunctionConfig
  auth?: AuthConfig
  workerRequest?: (type: string, payload?: any) => void | Promise<any>
  ws?: {
    open: (client: ClientContext) => void
    close: (client: ClientContext) => void
  }
  http?: {
    open: (client: ClientContext) => void
    close: (client: ClientContext) => void
  }
}

export class BasedServer {
  public functions: BasedFunctions

  public auth: BasedAuth

  public port: number

  public uwsApp: uws.TemplatedApp

  public listenSocket: any

  public worker: Worker

  // opposite of blocked can never get blocked
  public whiteList: Set<string> = new Set()

  // per ip so consitent unfortanetly
  // check how large it is and make a loop to downgrade it
  public requestsCounter: Map<
    string,
    {
      requests: number
      errors?: Map<BasedErrorCode, number>
    }
  > = new Map()

  public requestsCounterInProgress: boolean = false

  public requestsCounterTimeout: NodeJS.Timeout

  public observableCache: Map<number, ObservableCache> = new Map()

  public listeners: {
    [E in Event]?: Listener<EventMap[E]>[]
  } = {}

  constructor(opts: ServerOptions) {
    this.functions = new BasedFunctions(this, opts.functions)
    this.worker = createWorker(this)
    this.auth = new BasedAuth(this, opts.auth)
    attachNetwork(this, opts)
  }

  emit(
    type: Event,
    clientContext: ClientContext,
    val: EventMap[Event],
    err?: Error
  ) {
    if (this.listeners[type]) {
      this.listeners[type].forEach((fn) => fn(clientContext, val, err))
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

    // add importwrapper

    await wait(10)
    return new Promise((resolve, reject) => {
      this.uwsApp.listen(this.port, sharedSocket ? 0 : 1, (listenSocket) => {
        if (listenSocket) {
          console.info('💫  Based-edge-server listening on port:', this.port)
          // do this better wrap a nice thing arround it
          this.listenSocket = listenSocket
          resolve(this)
        } else {
          console.info('🤮  Based-edge-server error on port:', this.port)
          reject(new Error('Cannot start based-server on port: ' + this.port))
        }
      })
    })
  }

  async destroy() {
    console.info('🔥 Destroy Based-edge-server')
    if (this.listenSocket) {
      uws.us_listen_socket_close(this.listenSocket)
      this.listenSocket = null
    }
    this.listenSocket = null
    this.uwsApp = null
  }
}
