import { BasedServer } from '../../..'
import Client from '../../../Client'
import {
  RequestTypes,
  SubscriptionData,
  ErrorObject,
  SubscriptionDiffData,
} from '@based/client'

import { createPatch } from '@saulx/diff'
import { DataListener } from '../../../types'
import { Params } from '../../../Params'

import { hashObjectIgnoreKeyOrder } from '@saulx/hash'

type GenericObject = { [key: string]: any }

export class SharedConfigurationObservable {
  public lastDiff: [GenericObject, number]

  public server: BasedServer
  public removeTimer: NodeJS.Timeout
  public id: number
  // will store the close funciton in here unfortunately
  // handle abort of functions or something
  public clients: { [id: string]: [Client, number, 0 | 1 | 2] } = {}

  public dataListenersCnt = 0
  public dataListeners: { [id: string]: Set<DataListener> }

  public clientsCnt: number = 0
  public errorState: ErrorObject
  public payload: GenericObject
  public state: GenericObject
  public checksum: number
  public close: () => void
  public isClosed: boolean
  public params: Params
  public name: string

  public fnCleanup: () => void

  public functions: any = {}

  constructor(
    server: BasedServer,
    id: number,
    client?: Client, // tmp
    fn?: DataListener
  ) {
    this.id = id
    server.subscriptions[id] = this

    let cnt = 0
    // this.update({ hello: 'hello put', cnt, functions: this.functions })
    setInterval(() => {
      this.update({ hello: 'hello put', cnt: ++cnt, functions: this.functions })
    }, 1e3)

    this.server = server

    // TODO: actually produce a real configuration
    this.observeFunctions()
  }

  async observeFunctions() {
    this.fnCleanup = await this.server.config.functionConfig.subscribeFunctions(
      (err, fns) => {
        if (err) {
          this.restart()
          return
        }

        this.functions = fns
      }
    )
  }

  async restart() {
    if (this.isClosed) {
      return
    }

    if (this.fnCleanup) {
      this.fnCleanup()
    }

    this.observeFunctions().catch((e) => {
      console.error('Error observing functions', e)
      this.restart()
    })
  }

  update(data: GenericObject, version?: number) {
    if (typeof data !== 'object') {
      console.error(
        'observables need to use objects as data type',
        this.name,
        data
      )
    } else {
      if (!version) {
        version = !data ? 0 : hashObjectIgnoreKeyOrder(data)
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
            this.id,
            diff,
            [checksum, version],
          ]
        } catch (err) {
          // cannot create patch
          console.error('cannot create patch', err)
        }
      }
      if (!payload) {
        if (this.lastDiff) {
          delete this.lastDiff
        }
        payload = [RequestTypes.Subscription, this.id, data, version]
      }
      // only do this is you see that it is the same data object (so first diff will not be a diff)
      // remove deep copy here -- way too heavy...

      // lets see...

      // deepCopy
      // this is such a big waste...
      // find something for this...

      if (!data) {
        console.warn(
          'No data supplied - default to empty object',
          this.name,
          this.payload
        )
      }

      this.state = data || {}

      this.checksum = version

      if (this.dataListeners) {
        for (const id in this.dataListeners) {
          this.dataListeners[id].forEach((fn) => {
            fn(this.state, this.checksum)
          })
        }
      }

      for (const id in this.clients) {
        const c = this.clients[id]
        if (version !== c[1]) {
          c[1] = version

          c[0].send(payload)
          if (c[2] === 1) {
            // have to make it different if it converts to a subscription
            this.unsubscribe(c[0])
          }
        } else if (c[2]) {
          c[1] = version
          c[0].send([RequestTypes.Subscription, this.id, null, version])
          if (c[2] === 1) {
            this.unsubscribe(c[0])
          }
        }
      }
    }
  }

  error(err: Error) {
    // SEND ERROR
    console.info(err)
  }

  destroyIfEmpty() {
    // different close also needs to be called for every client :/
    if (this.clientsCnt === 0 && this.dataListenersCnt === 0) {
      this.removeTimer = setTimeout(() => {
        if (this.close) {
          try {
            this.close()
          } catch (err) {
            console.error('Cannot close user defined observable')
          }
        }
        delete this.server.subscriptions[this.id]

        // clean up compound observables
        if (this.fnCleanup) {
          this.fnCleanup()
        }

        this.isClosed = true
      }, 5e3)
    }
  }

  unsubscribe(client: Client) {
    if (this.clients[client.id]) {
      delete this.clients[client.id]
      delete client.subscriptions[this.id]
      this.clientsCnt--
      this.destroyIfEmpty()
    }
  }

  unsubscribeDataListener(
    client: Client | void,
    fn: DataListener,
    id?: string
  ) {
    if (this.dataListeners?.[id]) {
      this.dataListeners[id].delete(fn)
      if (this.dataListeners[id].size === 0) {
        delete this.dataListeners[id]
        this.dataListenersCnt--
        this.destroyIfEmpty()
      }
    }
  }

  subscribeDataListener(client: Client | void, fn: DataListener, id?: string) {
    if (!this.dataListeners) {
      this.dataListeners = {}
    }
    if (!this.dataListeners[id]) {
      this.dataListenersCnt++
      this.dataListeners[id] = new Set()
      if (this.removeTimer) {
        clearTimeout(this.removeTimer)
      }
    }

    if (this.state) {
      fn(this.state, this.checksum)
    } else if (this.errorState) {
      fn(null, 0, this.errorState)
    }

    this.dataListeners[id].add(fn)
  }

  // get 0 = normal sub, 1 = get, 2 = sub but force get
  subscribe(client: Client, checksum?: number, get: 0 | 1 | 2 = 0) {
    if (!client.subscriptions) {
      client.subscriptions = {}
    }
    if (this.removeTimer) {
      clearTimeout(this.removeTimer)
    }

    let isSend = false

    if (get !== 1) {
      this.clients[client.id] = [client, checksum, get]
      client.subscriptions[this.id] = this
      this.clientsCnt++
    }

    if (this.errorState) {
      const payload: SubscriptionData = [
        RequestTypes.Subscription,
        this.id,
        {},
        0,
        this.errorState,
      ]
      isSend = true
      client.send(payload)
    } else if (this.state) {
      if (checksum === this.checksum) {
        // console.info('got version dont re-send')
        if (get) {
          const payload: SubscriptionData = [
            RequestTypes.Subscription,
            this.id,
            null,
            checksum,
            this.errorState,
          ]
          isSend = true
          client.send(payload)
        }
      } else {
        if (this.clients[client.id]) {
          this.clients[client.id][1] = this.checksum
        }
        // this send has to be checked dont want to resend if it immediatly updates from the sub
        if (this.lastDiff && this.lastDiff[1] === checksum) {
          const payload: SubscriptionDiffData = [
            RequestTypes.SubscriptionDiff,
            this.id,
            this.lastDiff[0],
            [this.lastDiff[1], checksum],
          ]
          isSend = true
          client.send(payload)
        } else {
          const payload: SubscriptionData = [
            RequestTypes.Subscription,
            this.id,
            this.state,
            this.checksum,
          ]
          isSend = true
          client.send(payload)
        }
      }
    }

    if (get === 1) {
      if (isSend) {
        this.destroyIfEmpty()
      } else {
        this.clients[client.id] = [client, checksum, get]
        client.subscriptions[this.id] = this
        this.clientsCnt++
      }
    }
  }

  sendData(client: Client) {
    // this is easy to emulate
    if (this.checksum && !this.errorState) {
      const store = this.clients[client.id]
      if (store) {
        store[1] = this.checksum
        const payload: SubscriptionData = [
          RequestTypes.Subscription,
          this.id,
          this.state,
          this.checksum,
        ]
        client.send(payload)
      }
    }
  }
}
