import { BasedServer } from '../../..'
import Client from '../../../Client'
import {
  RequestTypes,
  SubscriptionData,
  ErrorObject,
  // SubscriptionDiffData,
} from '@based/client'

import { deepCopy } from '@saulx/utils'

import { createPatch } from '@saulx/diff'
import { DataListener, ObservableFunction } from '../../../types'
import { Params } from '../../../Params'
import { getFunction } from '../../../getFromConfig'

import { hashObjectIgnoreKeyOrder } from '@saulx/hash'

type GenericObject = { [key: string]: any }

console.info('xxx!#@#!!@#!@#')

export class SharedFunctionObservable {
  public lastDiff: number
  public jsonDiffCache: string
  public jsonCache: string

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

  constructor(
    server: BasedServer,
    id: number,
    payload: GenericObject,
    functionDefinition: ObservableFunction,
    name: string,
    client?: Client, // tmp
    fn?: DataListener
  ) {
    this.id = id
    server.subscriptions[id] = this
    this.payload = payload
    this.name = name
    // shared never from a callstack...
    // update needs to be bound
    // can maybe extend the name thing here...
    this.params = new Params(server, payload, null, [name], (val, version) =>
      this.update(val, version)
    )

    functionDefinition
      .function(this.params)
      .then((close) => {
        if (this.isClosed) {
          close()
        } else {
          this.close = close
        }
      })
      .catch((err) => {
        const errObject = {
          type: err.name,
          name: `observable "${name}"`,
          message: err.message,
          payload,
          auth: err.name === 'AuthorizationError',
        }
        console.error('Make observable error', this.name, err)

        if (fn) {
          fn(null, 0, errObject)
        } else if (client) {
          client.send([RequestTypes.Subscription, id, {}, 0, errObject])
        }
      })

    this.server = server
  }

  async restart() {
    if (this.isClosed) {
      return
    }

    const functionDefinition = await getFunction(this.params.server, this.name)

    if (functionDefinition) {
      if (this.close) {
        this.close()
      }
      functionDefinition
        .function(this.params)
        .then((close) => {
          if (this.isClosed) {
            close()
          } else {
            this.close = close
          }
          // this is a bit of a problem - the close needs to be handled differently
        })
        .catch((err) => {
          console.error('restart error handler not done', this.name, err)
          // update do this later
        })
    } else {
      console.error('FN NOT DEFINED ANYMORE', this.name)
      // TODO: empty and destroy !!
      // this.destroyIfEmpty()
    }

    // nessecary for updating functions
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

      if (version && version !== this.checksum) {
        let payload: string // SubscriptionData | SubscriptionDiffData

        if (this.state) {
          const s = this.state
          const checksum = this.checksum
          try {
            const diff = createPatch(s, data)
            this.lastDiff = checksum
            payload = this.jsonDiffCache = `[2,${this.id},${JSON.stringify(
              diff
            )},[${checksum},${version}]]`
          } catch (err) {
            // cannot create patch
            console.error('cannot create patch', err)
          }
        }

        if (!payload) {
          if (this.lastDiff) {
            delete this.lastDiff
          }
          payload = `[1,${this.id},${JSON.stringify(data)},${version}]`
          this.jsonCache = payload
        } else {
          this.jsonCache = `[1,${this.id},${JSON.stringify(data)},${version}]`
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

        this.state = deepCopy(data) || {}

        if (this.dataListeners) {
          for (const id in this.dataListeners) {
            this.dataListeners[id].forEach((fn) => {
              fn(this.state, this.checksum)
            })
          }
        }

        let sameVersion: string

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
            if (!sameVersion) {
              sameVersion = `[1,${this.id},null,${version}]`
            }
            c[1] = version
            c[0].send(sameVersion)
            if (c[2] === 1) {
              this.unsubscribe(c[0])
            }
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
      if (checksum && checksum === this.checksum) {
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
        if (checksum && this.lastDiff === checksum) {
          //

          // const payload: SubscriptionDiffData = [
          //   RequestTypes.SubscriptionDiff,
          //   this.id,
          //   this.lastDiff[0],
          //   [this.lastDiff[1], checksum],
          // ]
          isSend = true
          // cache this
          client.send(this.jsonDiffCache)
        } else {
          // const payload: SubscriptionData = [
          //   RequestTypes.Subscription,
          //   this.id,
          //   this.state,
          //   this.checksum,
          // ]
          isSend = true
          client.send(this.jsonCache)
        }
      }
    }

    console.log('xxxx', get)

    if (get === 1) {
      console.log('ehhlo')
      if (isSend) {
        this.destroyIfEmpty()
      } else {
        this.clients[client.id] = [client, checksum, get]
        client.subscriptions[this.id] = this
        this.clientsCnt++
      }
    }

    console.log('👻 DONE')
  }

  sendData(client: Client) {
    // this is easy to emulate
    if (this.checksum && !this.errorState) {
      const store = this.clients[client.id]
      if (store) {
        store[1] = this.checksum
        // const payload: SubscriptionData = [
        //   RequestTypes.Subscription,
        //   this.id,
        //   this.state,
        //   this.checksum,
        // ]
        client.send(this.jsonCache)
      }
    }
  }
}
