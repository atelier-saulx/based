import {
  BasedOpts,
  ClientAuthState as AuthState,
  FunctionResponseListeners,
  Settings,
  FunctionQueue,
  ObserveState,
  ObserveQueue,
  Cache,
  GetObserveQueue,
  GetState,
  ChannelQueue,
  ChannelPublishQueue,
  ChannelState,
  CallOptions,
  QueryOptions,
} from './types/index.js'
import { Connection } from './websocket/types.js'
import connectWebsocket from './websocket/index.js'
import Emitter from './Emitter.js'
import {
  addChannelPublishIdentifier,
  addChannelSubscribeToQueue,
  addObsToQueue,
  addToFunctionQueue,
  drainQueue,
  sendAuth,
} from './outgoing/index.js'
import { incoming } from './incoming/index.js'
import { BasedClientQuery } from './query/index.js'
import startStream from './stream/index.js'
import {
  StreamFunctionOpts,
  StreamQueue,
  StreamFunctionResponseListeners,
} from './stream/types.js'
import {
  initStorage,
  clearStorage,
  updateStorage,
} from './persistentStorage/index.js'
import { BasedChannel } from './channel/index.js'
import parseOpts from '@based/opts'
import { freeCacheMemory } from './cache.js'
import { cacheId } from './incoming/forceReload.js'
import { deepEqual } from '../utils/index.js'
import hashObjectIgnoreKeyOrder from '../hash/hashObjectIgnoreKeyOrder.js'

export * from './authState/parseAuthState.js'

export { cacheId }

export { AuthState as ClientAuthState, BasedClientQuery }

const isBrowser = typeof window !== 'undefined'
let lastReloadSeqId = -1

if (isBrowser) {
  if (typeof global === 'undefined') {
    window.global = window
  }
  const loc = window.location.href
  if (loc.includes(cacheId)) {
    const [url, lastSeqId] = loc.split(cacheId)
    if (lastSeqId) {
      lastReloadSeqId = Number(lastSeqId)
      window.history.replaceState(null, document.title, url)
    }
  }
}

let env
const getEnv = async (): Promise<string> => {
  if (env === undefined) {
    env = global.BASED?.opts?.env
    if (!env && typeof process === 'object') {
      env = process.env.ENV
    }
    env ||= ''
  }

  return env
}

export class BasedClient extends Emitter {
  constructor(opts?: BasedOpts, settings?: Settings) {
    super()

    if (settings?.persistentStorage) {
      this.storagePath = settings.persistentStorage
    }
    if (settings?.maxCacheSize) {
      this.maxCacheSize = settings.maxCacheSize
    }

    if (settings?.restFallBack) {
      this.restFallBack = settings.restFallBack
    }

    if (opts) {
      this.connect(opts)
    }
  }

  // --------- Restfallback http 1.1 / Proxies
  restFallBack?: Settings['restFallBack']
  // --------- Force reconnect
  lastForceId: number = lastReloadSeqId
  // --------- Persistent Storage
  storageSize: number = 0
  maxStorageSize: number = 5e6 - 500 // ~5mb
  storageEnvKey: number = 0
  storagePath?: string
  storageBeingWritten?: ReturnType<typeof setTimeout>
  // --------- Connection State
  opts?: BasedOpts
  connected: boolean = false
  connection?: Connection
  url?: () => Promise<string>
  // --------- Stream
  outgoingStreams: Map<
    string,
    {
      stream: any
      resolve: (result: any) => void
      reject: (err: Error) => void
    }[]
  > = new Map()

  isDrainingStreams: boolean = false
  // --------- Queue
  maxPublishQueue: number = 1000
  pQ: ChannelPublishQueue = []
  fQ: FunctionQueue = []
  sQ: StreamQueue = []
  oQ: ObserveQueue = new Map()
  cQ: ChannelQueue = new Map()
  gQ: GetObserveQueue = new Map()
  drainInProgress: boolean = false
  drainTimeout?: ReturnType<typeof setTimeout>
  idlePing?: ReturnType<typeof setTimeout>
  // --------- Cache State
  cacheSize: number = 0
  localStorage: boolean = false
  maxCacheSize: number = 5e7 // 50MB
  cache: Cache = new Map()
  // --------- Function State
  functionResponseListeners: FunctionResponseListeners = new Map()
  requestId: number = 0 // max 3 bytes (0 to 16777215)
  // --------- Channel State
  channelState: ChannelState = new Map()
  channelCleanTimeout?: ReturnType<typeof setTimeout> | null
  channelCleanupCycle: number = 30e3
  // --------- Observe State
  observeState: ObserveState = new Map()
  // --------- Get State
  getState: GetState = new Map()
  // -------- Auth state
  authState: AuthState = {}
  authRequest: {
    authState: AuthState | null
    promise: Promise<AuthState> | null
    resolve: ((result: AuthState) => void) | null
    reject: ((err: Error) => void) | null
    inProgress: boolean
  } = {
    authState: null,
    promise: null,
    resolve: null,
    reject: null,
    inProgress: false,
  }
  // --------- Function State
  streamFunctionResponseListeners: StreamFunctionResponseListeners = new Map()
  streamRequestId: number = 0 // max 3 bytes (0 to 16777215)

  // cache
  clearUnusedCache() {
    freeCacheMemory(this)
  }

  // --------- Internal Events
  onClose() {
    this.connected = false
    // Rare edge case where server got dc'ed while sending the queue - before recieving result)
    if (this.functionResponseListeners.size > this.fQ.length) {
      this.functionResponseListeners.forEach((p, k) => {
        if (
          !this.fQ.find(([id]) => {
            if (id === k) {
              return true
            }
            return false
          })
        ) {
          p[1](
            new Error(
              `Server disconnected before function result was processed`,
            ),
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
      if (!this.oQ.has(id)) {
        const cachedData = this.cache.get(id)
        addObsToQueue(this, obs.name, id, obs.payload, cachedData?.c || 0)
      }
    }

    // Resend all channels
    for (const [id, channel] of this.channelState) {
      if (!this.cQ.has(id)) {
        if (channel.subscribers.size) {
          addChannelSubscribeToQueue(this, channel.name, id, channel.payload)
        } else {
          addChannelPublishIdentifier(this, channel.name, id, channel.payload)
        }
      }
    }

    drainQueue(this)
  }

  onData(data: any) {
    incoming(this, data)
  }

  // --------- Connect
  /**
  Connect to a server or based cluster
  
  ```javascript
  // Connects to a specific based server
  client.connect({
    url: 'ws://localhost:9910'
  })

  // Connects to an environment in the based cloud
  client.connect({
    org: 'saulx',
    project: 'demo',
    env: 'production'
  })
  ```
   */
  public async connect(opts?: BasedOpts) {
    if (opts && Object.keys(opts).length > 0) {
      if (opts.env?.toLowerCase() === '#branch') {
        opts = {
          ...opts,
          env: await getEnv(),
        }
      }
      if (opts.lazy === true) {
        opts.lazy = {
          keepAlive: 3e3,
        }
      }
      if (this.opts) {
        if (deepEqual(this.opts, opts)) {
          return
        }
        this.disconnect()
      }
      this.opts = opts
      this.url = () => parseOpts(opts)
      this.storageEnvKey = hashObjectIgnoreKeyOrder(opts)
      initStorage(this)
    }

    if (!this.opts) {
      console.error('Configure opts to connect')
      return
    }

    if (this.url && !this.connection && !this.opts.lazy) {
      this.connection = connectWebsocket(this, this.url)
    }
  }

  /**
  Disconnect the client
  
  ```javascript
  client.disconnect()
  ```
   */
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
    clearTimeout(this.drainTimeout)
    clearTimeout(this.idlePing)
    this.connected = false
  }

  // ---------- Destroy
  public isDestroyed?: boolean

  /**
  Destroy the client, will remove all internals and cannot be resued,
  will update localStorage with the all `persistent` queries in memory
  
  ```javascript
  await client.destroy()

  // Do not update localStorage with current state
  await client.destroy(true)
  ```
   */
  public async destroy(noStorage?: boolean) {
    if (!noStorage) {
      await updateStorage(this, true)
    }
    clearTimeout(this.storageBeingWritten)
    clearTimeout(this.channelCleanTimeout!)
    this.disconnect()
    for (const i in this) {
      delete this[i]
    }
    this.isDestroyed = true
  }

  // ---------- Channel

  /**
  Subscribe or publish to a channel, channels are stateless
  
  ```javascript
  client.channel('events', { type: 'pageview' })
    .subscribe(event => console.info(event))

  client.channel('events', { type: 'pageview' })
    .publish({ path: '/home' })
  ```
   */
  channel(name: string, payload?: any): BasedChannel {
    return new BasedChannel(this, name, payload)
  }

  // ---------- Query
  /**
  Query, subscribe or get from a query function, query functions keep their current state memcached
  
  ```javascript
  // Receive updates 
  client.query('db', { 
    $id: 'userid',
    posts: true
  }).subscribe(data => console.info(data))

  // Receive updates, and store in localStorage 
  client.query('db', { 
    $id: 'userid',
    posts: true
  }, { persistent: true })
    .subscribe(data => console.info(data))

  // Get the current state of a user
  await client.query('db', { 
    $id: 'userid',
    email: true
  }).get()
  ```
  */
  query(name: string, payload?: any, opts?: QueryOptions): BasedClientQuery {
    return new BasedClientQuery(this, name, payload, opts)
  }

  // -------- Function
  /**
  Callable function, mostly used for modifications.
  */
  call(name: string, payload?: any, opts?: CallOptions): Promise<any> {
    const retryStrategy = opts?.retryStrategy
    if (retryStrategy) {
      return new Promise((resolve, reject) => {
        let time = 0
        let retries = 0
        const retryReject = async (err: Error) => {
          try {
            const result = await retryStrategy(err, time, retries)
            const isObj = typeof result === 'object'
            const newPayload = (isObj ? result!.payload : payload) ?? payload
            const newTime = isObj ? result!.time : result
            retries++
            if (typeof newTime === 'number' && !isNaN(newTime)) {
              time = newTime
              if (newTime === 0) {
                addToFunctionQueue(this, newPayload, name, resolve, retryReject)
              } else {
                setTimeout(() => {
                  addToFunctionQueue(
                    this,
                    newPayload,
                    name,
                    resolve,
                    retryReject,
                  )
                }, newTime)
              }
            } else {
              reject(err)
            }
          } catch (e) {
            reject(e)
          }
        }
        return addToFunctionQueue(this, payload, name, resolve, retryReject)
      })
    } else {
      return new Promise((resolve, reject) => {
        return addToFunctionQueue(this, payload, name, resolve, reject)
      })
    }
  }

  // -------- Stream
  /**
  Stream large payload to a `stream-function`
  
  ```javascript
  await client.stream('db:file', file)
  ```
  */
  stream(
    name: string,
    stream: StreamFunctionOpts,
    progressListener?: (progress: number, bytes: number) => void,
  ): Promise<any> {
    return startStream(this, name, stream, progressListener)
  }

  // -------- Auth
  /**
  Set auth state on client and server, `persistent` 
  will keep the authState in localStorage
  
  ```javascript
  await client.setAuthState({ token: 'token', persistent: true })
  ```
  */
  setAuthState(authState: AuthState): Promise<AuthState> {
    if (typeof authState === 'object') {
      return sendAuth(this, authState)
    } else {
      throw new Error('Invalid auth() arguments')
    }
  }

  /**
  Removes the current authState on server and client
  
  ```javascript
  await client.clearAuthState()
  ```
  */
  clearAuthState(): Promise<AuthState> {
    return sendAuth(this, {})
  }

  // -------- Storage layer
  /**
  Clear localStorage (removes storage file if configured for node.js)
  
  ```javascript
  await client.clearStorage()
  ```
  */
  clearStorage(): Promise<void> {
    return clearStorage(this)
  }

  /**
  Save current state of all cached query functions that have `persistent` set to true
  
  ```javascript
  await client.saveStorage()
  ```
  */
  saveStorage(): Promise<void> {
    return updateStorage(this)
  }
}

export { BasedOpts }

/**
  Creates a based client
  
  ```javascript
  // Connects to a specific based server
  const client = based({
    url: 'ws://localhost:9910'
  })

  // Connects to an environment in the based cloud
  const client = based({
    org: 'saulx',
    project: 'demo',
    env: 'production'
  })
  ```
*/
export default function based(
  opts: BasedOpts = {},
  settings?: Settings,
): BasedClient {
  if (globalThis.basedOpts && !opts.env && !opts.org && !opts.project) {
    opts = {
      ...globalThis.basedOpts,
      ...opts,
    }
  }
  return new BasedClient(opts, settings)
}

export type ClientQueryMap = {
  db: { payload: any; result: any }
  [key: string]: { payload: any; result: any }
}
