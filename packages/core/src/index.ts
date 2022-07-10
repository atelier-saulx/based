import {
  GenericObject,
  BasedOpts,
  closeObserve,
  ObserveOpts,
  observeDataListener,
  observeErrorListener,
  Auth,
} from './types'
import { Connection } from './websocket/types'
import connectWebsocket from './websocket'

import Emitter from './Emitter'
import getUrlFromOpts from './getUrlFromOpts'

/* 
-------------------
Allways starts with observing schema this is used to map types - also fits well with gql
-------------------
client.schema
client.observeSchema
-------------------
client.observe
client.get
-------------------
client.function 
-------------------
client.opts
client.disconnect
client.connect
client.debug (allows you to listen on messages)
-------------------
client.authState
client.auth
client.observeAuth
-------------------
*/

export class BasedCoreClient extends Emitter {
  // --------Generic options
  opts: BasedOpts

  connected: boolean = false

  connection: Connection // needs to be a class

  private _url: string | (() => Promise<string>)

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

  // -------------------
  public async connect(opts?: BasedOpts) {
    if (opts) {
      this._url = await getUrlFromOpts(opts)
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
    if (this._url && !this.connection) {
      this.connection = connectWebsocket(this, this._url)
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

  // -------------------

  observe(
    name: string,
    onData: observeDataListener,
    payload?: GenericObject,
    onErr?: observeErrorListener,
    observeOpts?: ObserveOpts
  ): closeObserve {
    console.info(name, onData, payload, onErr, observeOpts)
    return () => {}
  }

  async get(name: string, payload?: GenericObject): Promise<any> {
    // any is better
    console.info(name, payload)
  }

  // -------- Function
  async function(name: string, payload?: GenericObject): Promise<any> {
    // any is better
    console.info(name, payload)
  }

  // -------- Auth
  authState: Auth = { token: false }
  // more things prob have to make it better then this
  // renewtoken in here as well
  // or start of the cookie based auth
  authInProgress: Promise<Auth>
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
