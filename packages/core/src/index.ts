import {
  GenericObject,
  BasedOpts,
  CloseObserve,
  ObserveOpts,
  ObserveDataListener,
  ObserveErrorListener,
  Auth,
  Settings,
  ObserveState,
} from './types'
import { Connection } from './websocket/types'
import connectWebsocket from './websocket'
import Emitter from './Emitter'
import getUrlFromOpts from './getUrlFromOpts'

export class BasedCoreClient extends Emitter {
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
  // --------- Cache State
  localStorage: boolean = false
  maxCacheSize: number = 4e6 // in bytes
  maxCacheTime: number = 2630e3 // in seconds (1 month default)
  // --------- Observe State
  observeState: ObserveState = {}

  // -------- Auth state
  authState: Auth = { token: false }
  // more things prob have to make it better then this
  // renewtoken in here as well
  // or start of the cookie based auth
  authInProgress: Promise<Auth>

  // --------- Events
  onClose() {
    this.connected = false
    this.emit('disconnect', true)
  }

  onReconnect() {
    this.connected = true
    this.emit('reconnect', true)
  }

  onOpen() {
    this.connected = true
    this.emit('connect', true)
  }

  onData(data) {
    console.info('yes', data)
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

  // --------- Observe
  observe(
    name: string,
    onData: ObserveDataListener,
    payload?: GenericObject,
    onErr?: ObserveErrorListener,
    observeOpts?: ObserveOpts
  ): CloseObserve {
    console.info(name, onData, payload, onErr, observeOpts)
    return () => {}
  }

  async get(name: string, payload?: GenericObject): Promise<any> {
    console.info(name, payload)
  }

  // -------- Function
  async function(name: string, payload?: GenericObject): Promise<any> {
    console.info(name, payload)
  }

  // -------- Auth
  // maybe only send token on connect / upgrade
  async auth(token: string | false): Promise<any> {
    if (token === false) {
      this.authState = { token: false }
      this.emit('auth', this.authState)
    } else if (typeof token === 'string') {
      // do actual authentication
    }
  }
}

export { BasedOpts }
