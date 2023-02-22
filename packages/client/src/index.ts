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

export * from './authState/parseAuthState'

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
  url: string | (() => Promise<string>)
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
  public async connect(opts?: BasedOpts) {
    if (opts) {
      if (this.opts) {
        this.disconnect()
      }
      this.opts = opts
      this.url = await getUrlFromOpts(opts)
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
    clearTimeout(this.drainTimeout)
    clearTimeout(this.idlePing)
    this.connected = false
  }

  // ---------- Destroy
  public isDestroyed?: boolean
  public async destroy(noStorage?: boolean) {
    if (!noStorage) {
      await updateStorage(this)
    }
    clearTimeout(this.storageBeingWritten)
    clearTimeout(this.channelCleanTimeout)
    this.disconnect()
    this.isDestroyed = true
    for (const i in this) {
      delete this[i]
    }
  }

  // ---------- Channel
  channel(name: string, payload?: any): BasedChannel {
    return new BasedChannel(this, name, payload)
  }

  // ---------- Query
  query(
    name: string,
    payload?: any,
    opts?: { persistent: boolean }
  ): BasedQuery {
    return new BasedQuery(this, name, payload, opts)
  }

  // -------- Function
  call(name: string, payload?: any): Promise<any> {
    return new Promise((resolve, reject) => {
      addToFunctionQueue(this, payload, name, resolve, reject)
    })
  }

  // -------- Stream
  stream(
    name: string,
    stream: StreamFunctionOpts,
    progressListener?: (progress: number) => void
  ): Promise<any> {
    return startStream(this, name, stream, progressListener)
  }

  // -------- Auth
  setAuthState(authState: AuthState): Promise<AuthState> {
    if (typeof authState === 'object') {
      return sendAuth(this, authState)
    } else {
      throw new Error('Invalid auth() arguments')
    }
  }

  clearAuthState(): Promise<AuthState> {
    return sendAuth(this, {})
  }

  // -------- Storage layer
  clearStorage(): Promise<void> {
    return clearStorage(this)
  }

  saveStorage(): Promise<void> {
    return updateStorage(this)
  }
}

export { BasedOpts }

export default function based(
  opts: BasedOpts,
  settings?: Settings
): BasedClient {
  return new BasedClient(opts, settings)
}
