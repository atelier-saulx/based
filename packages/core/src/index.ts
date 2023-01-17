import {
  BasedOpts,
  AuthState,
  FunctionResponseListeners,
  Settings,
  FunctionQueue,
  ObserveState,
  ObserveQueue,
  Cache,
  GetObserveQueue,
} from './types'
import { GetState } from './types/observe'
import { Connection } from './websocket/types'
import connectWebsocket from './websocket'
import Emitter from './Emitter'
import getUrlFromOpts from './getUrlFromOpts'
import {
  addObsToQueue,
  addToFunctionQueue,
  drainQueue,
  sendAuth,
} from './outgoing'
import { incoming } from './incoming'
import { BasedQuery } from './query'

export class BasedClient extends Emitter {
  constructor(opts?: BasedOpts, settings?: Settings) {
    super()
    if (settings) {
      for (const k in settings) {
        this[k] = settings[k]
      }
    }
    if (opts) {
      this.connect(opts)
    }
  }

  // --------- Connection State
  opts: BasedOpts
  connected: boolean = false
  connection: Connection
  url: string | (() => Promise<string>)
  // --------- Queue
  functionQueue: FunctionQueue = []
  observeQueue: ObserveQueue = new Map()
  getObserveQueue: GetObserveQueue = new Map()
  drainInProgress: boolean = false
  drainTimeout: ReturnType<typeof setTimeout>
  idlePing: ReturnType<typeof setTimeout>
  // --------- Cache State
  localStorage: boolean = false
  maxCacheSize: number = 4e6 // in bytes
  maxCacheTime: number = 2630e3 // in seconds (1 month default)
  cache: Cache = new Map()
  // --------- Function State
  functionResponseListeners: FunctionResponseListeners = new Map()
  requestId: number = 0 // max 3 bytes (0 to 16777215)
  // --------- Observe State
  observeState: ObserveState = new Map()
  // --------- Get State
  getState: GetState = new Map()
  // -------- Auth state
  authState: AuthState = false
  authRequest: {
    authState: AuthState
    promise: Promise<AuthState>
    resolve: (result: AuthState) => void
    reject: (err: Error) => void
    inProgress: boolean
  } = {
    authState: null,
    promise: null,
    resolve: null,
    reject: null,
    inProgress: false,
  }

  // --------- Internal Events
  onClose() {
    this.connected = false
    // TODO: Do this on dc
    // Rare edge case where server got dc'ed while sending the queue - before recieving result)
    if (this.functionResponseListeners.size > this.functionQueue.length) {
      this.functionResponseListeners.forEach((p, k) => {
        if (
          !this.functionQueue.find(([id]) => {
            if (id === k) {
              return true
            }
            return false
          })
        ) {
          p[1](
            new Error(
              `Server disconnected before function result was processed`
            )
          )
          this.functionResponseListeners.delete(k)
        }
      })
    }
    this.emit('disconnect', true)
  }

  onReconnect() {
    this.connected = true
    this.emit('reconnect', true)
  }

  onOpen() {
    this.connected = true
    this.emit('connect', true)

    // Resend all subscriptions
    for (const [id, obs] of this.observeState) {
      if (!this.observeQueue.has(id)) {
        const cachedData = this.cache.get(id)
        addObsToQueue(
          this,
          obs.name,
          id,
          obs.payload,
          cachedData?.checksum || 0
        )
      }
    }

    drainQueue(this)
  }

  onData(data: any) {
    incoming(this, data)
  }

  // --------- Connect
  public async connect(opts?: BasedOpts) {
    if (opts) {
      this.url = await getUrlFromOpts(opts)
      if (this.opts) {
        console.warn('replace client connect opts')
        this.disconnect()
      }
      this.opts = opts
    }
    if (!this.opts) {
      console.error('Configure opts to connect')
      return
    }
    if (this.url && !this.connection) {
      this.connection = connectWebsocket(this, this.url)
    }
  }

  public disconnect() {
    if (this.connection) {
      this.connection.disconnected = true
      this.connection.destroy()
      if (this.connection.ws) {
        this.connection.ws.close()
      }
      if (this.connected) {
        this.onClose()
      }
      delete this.connection
    }
    this.connected = false
  }

  // ---------- Query
  query(name: string, payload?: any): BasedQuery {
    return new BasedQuery(this, name, payload)
  }

  // -------- Call-Function
  call(name: string, payload?: any): Promise<any> {
    return new Promise((resolve, reject) => {
      addToFunctionQueue(this, payload, name, resolve, reject)
    })
  }

  // TODO make this
  // -------- Stream-Function
  // File, NodeReadStream, anything else
  stream(name: string, streams?: any[]): Promise<any> {
    // do a http request - multipart under the hood (collecting multiple file uploads OR array)
    return new Promise((resolve, reject) => {
      addToFunctionQueue(this, streams, name, resolve, reject)
    })
  }

  // -------- Auth
  auth(authState: any): Promise<any> {
    if (authState === false) {
      this.authState = false
      this.emit('auth', this.authState)
      return sendAuth(this, this.authState)
    } else if (typeof authState === 'string' || typeof authState === 'object') {
      return sendAuth(this, authState)
    } else {
      throw new Error('Invalid auth() arguments')
    }
  }
}

export { BasedOpts }
