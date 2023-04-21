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
import {
  addChannelPublishIdentifier,
  addChannelSubscribeToQueue,
  addObsToQueue,
  addToFunctionQueue,
  drainQueue,
  sendAuth,
} from './outgoing'
import { incoming } from './incoming'
import { BasedQuery } from './query'
import startStream from './stream'
import { StreamFunctionOpts } from './stream/types'
import { initStorage, clearStorage, updateStorage } from './persistentStorage'
import { BasedChannel } from './channel'
import {
  ChannelQueue,
  ChannelPublishQueue,
  ChannelState,
} from './types/channel'
import { hashObjectIgnoreKeyOrder } from '@saulx/hash'
import parseOpts from '@based/opts'
import { retry } from '@saulx/utils'

export * from './authState/parseAuthState'

export * from './types/error'

export { AuthState, BasedQuery }

export class BasedClient extends Emitter {
  constructor(opts?: BasedOpts, settings?: Settings) {
    super()
    if (opts && Object.keys(opts).length > 0) {
      this.storageEnvKey = hashObjectIgnoreKeyOrder(opts)
      this.connect(opts)
    }
    if (settings?.persistentStorage) {
      this.storagePath = settings.persistentStorage
    }
    if (settings?.maxCacheSize) {
      console.warn('MaxCacheSize setting not implemented yet...')
      this.maxCacheSize = settings.maxCacheSize
    }
    initStorage(this)
  }

  // --------- Persistent Storage
  storageSize: number = 0
  maxStorageSize: number = 5e6 - 500 // ~5mb
  storageEnvKey: number = 0
  storagePath?: string
  storageBeingWritten?: ReturnType<typeof setTimeout>
  // --------- Connection State
  opts: BasedOpts
  connected: boolean = false
  connection: Connection
  url: () => Promise<string>
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
  publishQueue: ChannelPublishQueue = []
  functionQueue: FunctionQueue = []
  observeQueue: ObserveQueue = new Map()
  channelQueue: ChannelQueue = new Map()
  getObserveQueue: GetObserveQueue = new Map()
  drainInProgress: boolean = false
  drainTimeout: ReturnType<typeof setTimeout>
  idlePing: ReturnType<typeof setTimeout>
  // --------- Cache State
  localStorage: boolean = false
  maxCacheSize: number = 4e6 // in bytes
  cache: Cache = new Map()
  // --------- Function State
  functionResponseListeners: FunctionResponseListeners = new Map()
  requestId: number = 0 // max 3 bytes (0 to 16777215)
  // --------- Channel State
  channelState: ChannelState = new Map()
  channelCleanTimeout?: ReturnType<typeof setTimeout>
  channelCleanupCycle: number = 30e3
  // --------- Observe State
  observeState: ObserveState = new Map()
  // --------- Get State
  getState: GetState = new Map()
  // -------- Auth state
  authState: AuthState = {}
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

    // Resend all channels
    for (const [id, channel] of this.channelState) {
      if (!this.channelQueue.has(id)) {
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
    if (opts) {
      if (this.opts) {
        this.disconnect()
      }
      this.opts = opts
      this.url = () => parseOpts(opts)
    }
    if (!this.opts) {
      console.error('Configure opts to connect')
      return
    }
    if (this.url && !this.connection) {
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
      await updateStorage(this)
    }
    clearTimeout(this.storageBeingWritten)
    clearTimeout(this.channelCleanTimeout)
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
  query(
    name: string,
    payload?: any,
    opts?: { persistent: boolean }
  ): BasedQuery {
    return new BasedQuery(this, name, payload, opts)
  }

  // -------- Function
  /**
  Callable function, mostly used for modifications
  
  ```javascript
  await client.call('db:set', { 
    type: 'fruit', 
    subType: 'apple', 
    name: 'jonagold' 
  })
  ```
  */
  call(
    name: string,
    payload?: any,
    opts?: {
      retryStrategy: (
        err: Error,
        time: number,
        retries: number
      ) => 0 | null | undefined | false | number
    }
  ): Promise<any> {
    const retryStrategy = opts?.retryStrategy
    if (retryStrategy) {
      return new Promise((resolve, reject) => {
        let time = 0
        let retries = 0
        const retryReject = (err) => {
          const newTime = retryStrategy(err, time, retries)
          retries++
          if (typeof newTime === 'number' && !isNaN(newTime)) {
            if (newTime === 0) {
              addToFunctionQueue(this, payload, name, resolve, retryReject)
            } else {
              setTimeout(() => {
                addToFunctionQueue(this, payload, name, resolve, retryReject)
              }, newTime)
            }
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
    progressListener?: (progress: number) => void
  ): Promise<any> {
    return startStream(this, name, stream, progressListener)
  }

  // -------- Auth
  /**
  Set auth state on client and server, `persistent` 
  will keep the authState in localStorage
  
  ```javascript
  await client.setAuthState({ token: 'token', persitent: true })
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
  opts: BasedOpts,
  settings?: Settings
): BasedClient {
  return new BasedClient(opts, settings)
}
