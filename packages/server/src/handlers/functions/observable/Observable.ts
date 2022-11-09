import { BasedServer } from '../../..'
import Client from '../../../Client'
import {
  RequestTypes,
  SubscriptionData,
  SubscriptionDiffData,
} from '@based/client'
import { createPatch } from '@saulx/diff'
// DataListener
import { ObservableFunction, DataListener } from '../../../types'
import { deepCopy } from '@saulx/utils'
import { hashObjectIgnoreKeyOrder } from '@saulx/hash'
import { Params } from '../../../Params'
import { getFunction } from '../../../getFromConfig'

type GenericObject = { [key: string]: any }

export class UserEmitter {
  constructor(
    params: Params,
    observable: FunctionObservable,
    checksum?: number,
    get: 0 | 1 | 2 | 3 = 0,
    dataListener?: DataListener
  ) {
    this.checksum = checksum
    this.type = get
    this.params = params
    params.update = (d, v) => {
      try {
        this.update(d, v)
      } catch (err) {
        // log in the function
        console.error(err)
      }
    }
    this.observable = observable
    this.init(dataListener)
  }

  public dataListeners: Set<DataListener>

  onData(fn: DataListener) {
    if (!this.dataListeners) {
      this.dataListeners = new Set()
    }
    this.dataListeners.add(fn)
  }

  removeDataListener(fn: DataListener) {
    if (this.dataListeners) {
      this.dataListeners.delete(fn)
      if (this.dataListeners.size === 0) {
        delete this.dataListeners
        if (this.type === 3) {
          this.destroy()
        }
      }
    }
  }

  public isClosed: boolean

  public checksum: number

  public lastDiff: [GenericObject, number]

  public type: 0 | 1 | 2 | 3

  public params: Params

  public state: GenericObject

  private observable: FunctionObservable

  public close: () => void

  public isInit: boolean

  public init(fn?: DataListener) {
    this.isInit = true
    this.observable.functionDefinition
      .function(this.params)
      .then((close) => {
        if (this.isClosed) {
          close()
        } else {
          this.close = close
        }
      })
      .catch((err) => {
        const errObj = {
          type: err.name,
          name: `observable "${this.observable.name}"`,
          message: err.message,
          payload: this.observable.payload,
          auth: err.name === 'AuthorizationError',
        }
        if (fn) {
          fn(null, 0, errObj)
        } else {
          this.params.user.send([
            RequestTypes.Subscription,
            this.observable.id,
            {},
            0,
            errObj,
          ])
        }
      })
  }

  public update(data: GenericObject, version?: number) {
    if (typeof data !== 'object') {
      console.error('observables need to use objects as data type')
    } else {
      this.isInit = false
      if (!version) {
        version = hashObjectIgnoreKeyOrder(data)
      }
      let payload: SubscriptionData | SubscriptionDiffData
      if (this.state) {
        const s = this.state
        const checksum = this.checksum
        try {
          const diff = createPatch(s, data)
          this.lastDiff = [diff, checksum]
          payload = [
            RequestTypes.SubscriptionDiff,
            this.observable.id,
            diff,
            [checksum, version],
          ]
        } catch (err) {
          console.error('cannot create patch', err)
        }
      }
      if (!payload) {
        if (this.lastDiff) {
          delete this.lastDiff
        }
        payload = [RequestTypes.Subscription, this.observable.id, data, version]
      }
      this.state = deepCopy(data || {})

      if (this.dataListeners) {
        this.dataListeners.forEach((fn) => {
          fn(this.state, this.checksum)
        })
      }

      if (this.type !== 3) {
        if (version !== this.checksum) {
          this.checksum = version
          this.params.user.send(payload)
          if (this.type === 1) {
            this.observable.unsubscribe(this.params.user)
          }
        } else if (this.type) {
          this.checksum = version
          this.params.user.send([
            RequestTypes.Subscription,
            this.observable.id,
            null,
            version,
          ])
          if (this.type === 1) {
            this.observable.unsubscribe(this.params.user)
          }
        }
      }
    }
  }

  public error(data: GenericObject, version?: number) {
    console.info('error send it')
  }

  destroy() {
    delete this.observable.clients[this.params.user.id]
    delete this.params.user.subscriptions[this.observable.id]
    this.observable.clientsCnt--

    if (this.close) {
      try {
        this.close()
      } catch (err) {
        console.error('Cannot close user defined observable')
      }
    }

    this.observable.destroyIfEmpty()

    // delete this.observable.server.subscriptions[this.observable.id]
    this.isClosed = true
  }
}

export class FunctionObservable {
  public server: BasedServer
  public removeTimer: NodeJS.Timeout
  public id: number
  public clients: { [id: string]: UserEmitter } = {}

  public clientsCnt: number = 0
  public payload: GenericObject
  public isClosed: boolean
  public functionDefinition: ObservableFunction
  public name: string

  constructor(
    server: BasedServer,
    id: number,
    payload: GenericObject,
    functionDefinition: ObservableFunction,
    name: string
  ) {
    this.id = id
    this.functionDefinition = functionDefinition
    server.subscriptions[id] = this
    this.payload = payload
    this.server = server
    this.name = name
  }

  async restart() {
    const functionDefinition = await getFunction(this.server, this.name)
    if (functionDefinition) {
      for (const id in this.clients) {
        const emitter = this.clients[id]
        if (!emitter.isClosed) {
          if (emitter.close) {
            emitter.close()
          }
          emitter.init()
        }
      }
    }
  }

  unsubscribeDataListener(client: Client, fn: DataListener, id?: string) {
    const userSub = this.clients[client.id]
    if (userSub) {
      userSub.removeDataListener(fn)
    }
  }

  subscribeDataListener(client: Client, fn: DataListener, id?: string) {
    // console.info('go time', client, fn)
    const userSub = this.clients[client.id]

    if (userSub && !userSub.isClosed) {
      // yes attach
      userSub.onData(fn)
    } else {
      if (!client.subscriptions[this.id]) {
        client.subscriptions[this.id] = this
      }

      const params = new Params(this.server, this.payload, client, [
        id,
        this.name,
      ])

      this.clients[client.id] = new UserEmitter(params, this, 0, 3, fn)

      this.clients[client.id].onData(fn)

      this.clientsCnt++
    }
  }

  destroyIfEmpty() {
    if (this.clientsCnt === 0) {
      this.removeTimer = setTimeout(() => {
        delete this.server.subscriptions[this.id]
        this.isClosed = true
      }, 10)
    }
  }

  unsubscribe(client: Client) {
    if (this.clients[client.id]) {
      if (!this.clients[client.id].dataListeners) {
        this.clients[client.id].destroy()
      } else {
        this.clients[client.id].type = 3
      }
    }
  }

  subscribe(client: Client, checksum?: number, get: 0 | 1 | 2 = 0) {
    if (!client.subscriptions) {
      client.subscriptions = {}
    }
    if (this.removeTimer) {
      clearTimeout(this.removeTimer)
    }

    const userSub = this.clients[client.id]

    // && !userSub.isInit -- maybe dont need this!
    if (userSub && !userSub.isClosed) {
      if (get === 1) {
        // this is wrong
        const payload: SubscriptionData = [
          RequestTypes.Subscription,
          this.id,
          userSub.state,
          userSub.checksum,
        ]
        client.send(payload)
      } else {
        if (userSub.type === 3) {
          userSub.type = get
        }

        if (!client.subscriptions[this.id]) {
          client.subscriptions[this.id] = this
        }
        if (get === 2) {
          const payload: SubscriptionData = [
            RequestTypes.Subscription,
            this.id,
            userSub.state,
            userSub.checksum,
          ]
          client.send(payload)
        }
      }
    } else {
      // add the params

      const params = new Params(this.server, this.payload, client, [this.name])

      this.clients[client.id] = new UserEmitter(params, this, checksum, get)
      client.subscriptions[this.id] = this
      this.clientsCnt++
    }
  }

  sendData(client: Client) {
    const store = this.clients[client.id]
    if (store && store.state && store.checksum && !store.isInit) {
      const payload: SubscriptionData = [
        RequestTypes.Subscription,
        this.id,
        store.state,
        store.checksum,
      ]
      client.send(payload)
    }
  }
}
