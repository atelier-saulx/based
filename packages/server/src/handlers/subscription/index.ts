import { BasedServer } from '../..'
import { Observable } from '@saulx/selva'
import Client from '../../Client'
import {
  RequestTypes,
  SendSubscriptionDataMessage,
  SubscribeMessage,
  UnsubscribeMessage,
  SubscriptionData,
  ErrorObject,
  // SubscriptionDiffData,
} from '@based/client'
import { DataListener } from '../../types'

// type GenericObject = { [key: string]: any }
export class Subscription {
  // public lastDiff: [GenericObject, number]

  public lastDiff: number
  public jsonDiffCache: string
  public jsonCache: string

  public checksum: number
  public server: BasedServer
  public removeTimer: NodeJS.Timeout
  public observable: Observable
  public id: number
  public clients: { [id: string]: [Client, number] } = {}
  public clientsCnt: number = 0
  public errorState: ErrorObject
  public retryTimer: NodeJS.Timeout

  initSubscription(query, isSchemaSubscription) {
    this.observable.subscribe(
      (data, checksum, diff) => {
        if (isSchemaSubscription) {
          // TODO: investigage why this happens
          if (!this.observable) {
            console.error(
              '! Observable does not exists on schema - sub this should never happen...'
            )
            return
          }
          checksum = data.sha
          this.observable.version = checksum
          this.observable.cache = data
        }
        if (this.errorState) {
          delete this.errorState
        }
        let payload: string
        if (diff) {
          this.lastDiff = this.checksum

          if (isSchemaSubscription) {
            payload = this.jsonDiffCache = `[2,${this.id},${JSON.stringify(
              diff
            )},["${this.checksum}","${checksum}"]]`
          } else {
            payload = this.jsonDiffCache = `[2,${this.id},${JSON.stringify(
              diff
            )},[${this.checksum},${checksum}]]`
          }

          if (isSchemaSubscription) {
            this.jsonCache = `[1,${this.id},${JSON.stringify(
              data
            )},"${checksum}"]`
          } else {
            this.jsonCache = `[1,${this.id},${JSON.stringify(
              data
            )},${checksum}]`
          }
        } else {
          if (this.lastDiff) {
            delete this.lastDiff
            delete this.jsonDiffCache
          }

          if (isSchemaSubscription) {
            payload = this.jsonCache = `[1,${this.id},${JSON.stringify(
              data
            )},"${checksum}"]`
          } else {
            payload = this.jsonCache = `[1,${this.id},${JSON.stringify(
              data
            )},${checksum}]`
          }
        }
        for (const id in this.clients) {
          const c = this.clients[id]
          if (checksum !== c[1]) {
            c[1] = checksum
            c[0].send(payload)
          }
          // else if waiting for initial get... ?
          // TODO: may need fix
        }
        this.checksum = checksum
      },
      (err) => {
        if (err.message.includes('ERR_SUBSCRIPTIONS ENOENT')) {
          console.error('WRONG INIT SUB RETRY IN 500ms')
          this.retryTimer = setTimeout(() => {
            this.initSubscription(query, isSchemaSubscription)
          }, 500)
        } else {
          let validationErr = false
          if (!this.checksum) {
            // need to get type
            validationErr = true
            // initial error - then remove this sub ?
          }
          this.errorState = {
            type: validationErr ? 'ValidationError' : 'ObserveError',
            message: err.message,
            name: 'subscription',
            query,
          }
          const payload: SubscriptionData = [
            RequestTypes.Subscription,
            this.id,
            {},
            0,
            this.errorState,
          ]
          for (const id in this.clients) {
            const c = this.clients[id]
            c[0].send(payload)
          }
        }
      }
    )
  }

  constructor(server: BasedServer, id: number, query: any) {
    this.id = id
    server.subscriptions[id] = this

    const isSchemaSubscription = query.$subscribe_schema

    this.observable = isSchemaSubscription
      ? server.db.subscribeSchema(query.$subscribe_schema)
      : server.db.observe(query)

    this.server = server

    this.initSubscription(query, isSchemaSubscription)
  }

  // eslint-disable-next-line
  unsubscribeDataListener(client: Client, fn: DataListener, id?: string) {}

  // eslint-disable-next-line
  subscribeDataListener(client: Client, fn: DataListener, id?: string) {}

  unsubscribe(client: Client) {
    if (this.clients[client.id]) {
      delete this.clients[client.id]
      delete client.subscriptions[this.id]
      this.clientsCnt--
      if (this.clientsCnt === 0) {
        this.removeTimer = setTimeout(() => {
          clearTimeout(this.retryTimer)
          this.observable.unsubscribe()
          delete this.observable
          delete this.server.subscriptions[this.id]
        }, 5e3)
      }
    }
  }

  subscribe(client: Client, checksum?: number) {
    if (!client.subscriptions) {
      client.subscriptions = {}
    }
    if (this.removeTimer) {
      clearTimeout(this.removeTimer)
    }
    this.clients[client.id] = [client, checksum]
    client.subscriptions[this.id] = this
    this.clientsCnt++

    if (this.errorState) {
      const payload: SubscriptionData = [
        RequestTypes.Subscription,
        this.id,
        {},
        0,
        this.errorState,
      ]
      client.send(payload)
    } else if (this.jsonCache) {
      if (checksum === this.observable.version) {
        // console.info(
        //   'got version dont re-send',
        //   x,
        //   checksum,
        //   this.observable.version
        // )
      } else {
        this.clients[client.id][1] = this.observable.version
        // this send has to be checked dont want to resend if it immediatly updates from the sub
        if (this.lastDiff && this.lastDiff === checksum) {
          // const payload: SubscriptionDiffData = [
          //   RequestTypes.SubscriptionDiff,
          //   this.id,
          //   this.lastDiff[0],
          //   [this.lastDiff[1], this.observable.version],
          // ]

          client.send(this.jsonDiffCache)
        } else {
          // const payload: SubscriptionData = [
          //   RequestTypes.Subscription,
          //   this.id,
          //   this.observable.cache,
          //   this.observable.version,
          // ]

          client.send(this.jsonCache)
        }
      }
    } else {
      // console.info(x, 'kein informazaion')
    }
  }

  sendData(client: Client) {
    if (this.observable?.version && !this.errorState) {
      const store = this.clients[client.id]
      if (store) {
        store[1] = this.observable.version
        // const payload: SubscriptionData = [
        //   RequestTypes.Subscription,
        //   this.id,
        //   this.observable.cache,
        //   this.observable.version,
        // ]
        client.send(this.jsonCache)
      }
    }
  }
}

export const subscribe = (
  server: BasedServer,
  client: Client,
  [, id, query, checksum]: SubscribeMessage
) => {
  let subscription = server.subscriptions[id]
  if (!subscription) {
    subscription = new Subscription(server, id, query)
  }
  // pass
  subscription.subscribe(client, checksum)
}

export const sendSubscriptionData = (
  server: BasedServer,
  client: Client,
  [, subscriptionId]: SendSubscriptionDataMessage
) => {
  const subscription = client.subscriptions?.[subscriptionId]
  if (subscription) {
    subscription.sendData(client)
  } else {
    console.warn('Client does not have subscription for sendSubscriptionData')
  }
}

export const unsubscribe = (
  server: BasedServer,
  client: Client,
  [, subscriptionId]: UnsubscribeMessage
) => {
  if (client.subscriptions && client.subscriptions[subscriptionId]) {
    client.subscriptions[subscriptionId].unsubscribe(client)
  }
}
