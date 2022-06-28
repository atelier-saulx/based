import { BasedServer } from '../../..'
import Client from '../../../Client'
import {
  RequestTypes,
  SubscriptionData,
  ErrorObject,
  // SubscriptionDiffData,
} from '@based/client'

import { deepCopy } from '@saulx/utils'

import * as tb from 'typed-bytes'

import { createPatch } from '@saulx/diff'
import { DataListener, ObservableFunction } from '../../../types'
import { Params } from '../../../Params'
import { getFunction } from '../../../getFromConfig'
import Tbjson from 'typed-binary-json'

import { hashObjectIgnoreKeyOrder } from '@saulx/hash'

import UTP from './utp'

type GenericObject = { [key: string]: any }

const subType = tb.Object({
  data: tb.string,
  id: tb.number,
  version: tb.number,
})

UTP.addSchema('subType', [
  { name: 'id', type: UTP.TYPE.UINT32 },
  { name: 'version', type: UTP.TYPE.UINT32 },
  { name: 'data', type: UTP.TYPE.STRING },
])

class SubType {}
let tbjson = new Tbjson()
// make "A" a known class type
// @ts-ignore
// SubType.tbjson = {
//   definition: {
//     id: Tbjson.TYPES.UINT64,
//     version: Tbjson.TYPES.UINT64,
//     data: Tbjson.TYPES.STRING,
//   },
// }

// const subType = avro.parse({
//   name: 'Subscription',
//   type: 'record',
//   fields: [
//     { name: 'id', type: 'long' },
//     { name: 'version', type: 'long' },
//     { name: 'data', type: 'string' }, // can type it for queries
//   ],
// })

// const subDiffType = avro.parse({
//   name: 'SubscriptionDiff',
//   type: 'record',
//   fields: [
//     { name: 'id', type: 'long' },
//     { name: 'version', type: 'long' },
//     { name: 'fromVersion', type: 'long' },
//     { name: 'data', type: 'string' }, // can type it for queries - which is AMAZING
//   ],
// })

// this.jsonCache = `[1,${this.id},${JSON.stringify(data)},${version}]`

// console.log('hello', subType)

// type diffs - also a nice upgrade

export class SharedFunctionObservable {
  public lastDiff: number
  public jsonDiffCache: Uint8Array | Buffer | string
  public jsonCache: Uint8Array | Buffer | string

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
        // console.error('Make observable error', this.name, err)

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
        let payload: Uint8Array | Buffer | string

        // if (this.state && this.checksum) {
        //   const s = this.state

        //   const checksum = this.checksum
        //   try {
        //     const diff = createPatch(s, data)
        //     this.lastDiff = checksum
        //     console.info('hell233')

        //     payload = this.jsonDiffCache = subDiffType.toBuffer({
        //       version,
        //       fromVersion: checksum,
        //       data: JSON.stringify(diff),
        //     })

        //     // var buf = type.toBuffer(pet);

        //     // payload = this.jsonDiffCache = `[2,${this.id},${JSON.stringify(
        //     //   diff
        //     // )},[${checksum},${version}]]`
        //   } catch (err) {
        //     // cannot create patch
        //     console.error('cannot create patch', err)
        //   }
        // }

        this.checksum = version

        if (!payload) {
          if (this.lastDiff) {
            delete this.lastDiff
            delete this.jsonDiffCache
          }

          // const x = new SubType()

          // // @ts-ignore
          // x.version = version
          // // @ts-ignore
          // x.data = JSON.stringify(data)
          // // @ts-ignore
          // x.id = this.id
          // try {
          //   payload = this.jsonCache = tbjson.serializeToBuffer(x)
          // } catch (err) {
          //   console.error('!!@!', err)
          // }

          // payload = `[1,${this.id},${JSON.stringify(data)},${version}]`
          // this.jsonCache = payload

          //   payload = this.jsonCache = subType.encode({
          //     version,
          //     id: this.id,
          //     data: JSON.stringify(data),
          //   })

          // payload = this.jsonCache = UTP.encode('subType', {
          //   version,
          //   id: this.id,
          //   data: JSON.stringify(data),
          // })

          payload = this.jsonCache = subType.encode({
            version,
            id: this.id,
            data: JSON.stringify(data),
          })
          // this.jsonCache = `[1,${this.id},${JSON.stringify(data)},${version}]`
        }

        console.info(this.jsonCache)

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
          isSend = true
          client.send(this.jsonDiffCache)
        } else {
          isSend = true
          client.send(this.jsonCache)
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
    if (this.checksum && !this.errorState) {
      const store = this.clients[client.id]
      if (store) {
        store[1] = this.checksum
        client.send(this.jsonCache)
      }
    }
  }
}
