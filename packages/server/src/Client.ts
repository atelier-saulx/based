import uws from '@based/uws'
import { Subscription } from './handlers/subscription'
import {
  FunctionObservable,
  SharedFunctionObservable,
} from './handlers/functions/observable'
import { GenericObject, SendTokenOptions } from '@based/client'
import { decodeValueBySecret, decodeToken } from './secrets'
import { BasedServer } from '.'
import { deepMerge } from '@saulx/utils'
import parseResponse from './handlers/rest/parseResponse'
import { Geo } from './types'

import UAParser from 'ua-parser-js'

let clientId = 0

let totalBp = 0

type Ua = {
  ua: string
  browser: { name: string; version: string }
  engine: { name: string; version: string }
  os: { name: string; version: string }
  device: { vendor: string; model: string; type: string }
  cpu: { architecture: string }
}

// make abstract class (rest client)

// why not make this user less new things that need to be made
export class Client {
  authorizeInProgress?: Promise<any>

  origin?: string

  anonymous: boolean

  role: string

  private _geo: Geo

  private _unpackedToken: any

  private _ip: string

  private _token: string

  private _server: BasedServer

  private _session: GenericObject

  private _params: GenericObject

  private _ua: Ua

  public subscriptions: {
    [id: string]: Subscription | SharedFunctionObservable | FunctionObservable
  }

  public bpTimestamp: number

  public closed: boolean

  public id: number

  public isBasedUser: boolean = false

  public isApiKey: boolean = false

  public socket: uws.WebSocket

  public res: uws.HttpResponse

  public track: Set<string>
  public trackIso: string
  // make this a bit less specific in here...
  public type: 0 | 1

  params(name?: string) {
    if (this._params) {
      if (name) {
        return this._params[name] || null
      }
      return this._params
    }
    const s = this.socket
    if (s) {
      const params = {}
      this._params = params
      try {
        const arr = s.query.split(/\?|&/g)
        for (const pair of arr) {
          const [k, v = true] = pair.split('=')
          params[k] = v
        }
      } catch (err) {}
      if (name) {
        return this._params[name] || null
      }
      return this._params
    } else {
      return name ? null : {}
    }
  }

  session(obj?: GenericObject) {
    if (!this._session) {
      this._session = {}
    }
    if (obj) {
      if (!obj || typeof obj !== 'object') {
        console.error('Cannot set a non object on session')

        return this._session
      }
      deepMerge(this._session, obj)
    }
    return this._session
  }

  constructor(
    server: BasedServer,
    socket?: uws.WebSocket,
    res?: uws.HttpResponse,
    type: 0 | 1 = 0
  ) {
    this.id = ++clientId
    this._server = server

    if (socket) {
      this.socket = socket
      socket.client = this
    }

    this.type = type

    if (res) {
      this.res = res
    }
  }

  get ip(): string {
    if (this._ip) {
      return this._ip
    }

    if (this.socket) {
      return (this._ip = Buffer.from(
        this.socket.getRemoteAddressAsText()
      ).toString())
    }

    if (this.res) {
      return (this._ip = Buffer.from(
        this.res.getRemoteAddressAsText()
      ).toString())
    }

    return '::1'
  }

  get ua(): Ua {
    if (this._ua) {
      return this._ua
    }

    // UA Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/92.0.4515.159 Safari/537.36

    // fix the tablet etc
    const ua = (this._ua = new UAParser(
      (this.socket ? this.socket.ua : this.res.ua) || ''
    ).getResult())

    return ua
  }

  public setToken(token: string | false, opts?: SendTokenOptions) {
    if (token) {
      if (this._unpackedToken && this._token !== token) {
        delete this._unpackedToken
      }
      if (opts?.isApiKey) {
        this.isApiKey = true
      } else if (opts?.isBasedUser) {
        this.isBasedUser = true
      } else {
        this.isBasedUser = false
      }
      this._token = token
    } else {
      this.isApiKey = false
      this.isBasedUser = false
      if (this._unpackedToken) {
        delete this._unpackedToken
      }
      if (this._token) {
        delete this._token
      }
    }
  }

  get geo(): Geo {
    if (this._geo) {
      return this._geo
    }
    const getGeo = this._server.config?.getGeo
    if (this._server.config?.getGeo) {
      return (this._geo = getGeo(this.ip))
    } else {
      return {
        iso: 'unkown',
        regions: [],
        long: 0,
        lat: 0,
      }
    }
  }

  public async token(secret?: string, type: 'jwt' = 'jwt'): Promise<any> {
    if (this._unpackedToken) {
      return this._unpackedToken
    }
    if (this._token) {
      if (this.isApiKey) {
        const getApiTokensPublicKey = this._server?.config?.getApiKeysPublicKey
        if (getApiTokensPublicKey) {
          this._unpackedToken = await decodeToken(
            this._token,
            await getApiTokensPublicKey()
          )
        }
      } else if (this.isBasedUser) {
        if (secret) {
          throw new Error('Cannot validate based user with a custom secret')
        }
        const getBasedKey = this._server?.config?.getBasedKey
        if (getBasedKey) {
          this._unpackedToken = await decodeToken(
            this._token,
            await getBasedKey()
          )
        }
      } else {
        if (!secret) {
          return this._token
        }

        this._unpackedToken = await decodeValueBySecret(
          this._server,
          this._token,
          secret,
          type
        )
      }
    }
    return this._unpackedToken
  }

  public backpressureQueue: any[]

  public drain() {
    while (
      this.socket &&
      !this.closed &&
      !this.socket.getBufferedAmount() &&
      this.backpressureQueue?.length
    ) {
      totalBp--
      const [payload, time] = this.backpressureQueue.shift()

      if (Date.now() - time > 10e3) {
        this.backpressureQueue = []
        console.info('last bp is larger then 10 seconds destroy client')
        this.destroy()
        return
      }

      if (!this.socket.send(JSON.stringify(payload))) {
        console.info(
          'drain build bp --- ',
          this.backpressureQueue.length,
          'length in queue still'
        )
      }
    }
    // totalBpQ
    if (this.backpressureQueue?.length === 0) {
      this.backpressureQueue = null
    }
  }

  send(payload: any) {
    // here we are going to add checksum ALLWAYS
    if (this.res) {
      parseResponse(this.res, payload, this.type)
      this.destroy()
    } else if (!this.closed && this.socket) {
      if (this.socket.getBufferedAmount()) {
        if (!this.backpressureQueue) {
          this.backpressureQueue = []
        }

        if (this.backpressureQueue.length) {
          const time = this.backpressureQueue[0][1]
          if (Date.now() - time > 10e3) {
            this.backpressureQueue = []
            console.info('last bp is larger then 10 seconds destory')
            this.destroy()
            return
          }
        }

        totalBp++

        if (totalBp > 5e3) {
          console.info('Too much bp EXIT process')
          process.exit()
        }

        this.backpressureQueue.push([payload, Date.now()])

        if (this.backpressureQueue.length > 50) {
          this.backpressureQueue = []
          console.info('too large bp destroy client')
          this.destroy()
          return
        }

        console.info(
          'add to bp queue',
          this.backpressureQueue.length,
          this.socket.getBufferedAmount()
        )
      } else {
        if (!this.socket.send(JSON.stringify(payload))) {
          // console.info('drain build bp')
        }
      }
    } else {
      console.info('Not sending socket is closed ', !!this.socket, this.closed)
    }
  }

  destroy(socketClosed?: boolean) {
    this.closed = true

    if (this.backpressureQueue && this.backpressureQueue.length) {
      totalBp -= this.backpressureQueue.length
      this.backpressureQueue = []
    }
    if (this.subscriptions) {
      for (const id in this.subscriptions) {
        this.subscriptions[id].unsubscribe(this)
      }
    }
    if (this.socket) {
      this.socket.client = null
      if (!socketClosed) {
        this.socket.end()
      }
      this.socket = null
    } else {
      this.res = null
    }
  }
}

export default Client
