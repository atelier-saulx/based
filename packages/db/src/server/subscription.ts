import { readUint32, writeUint32 } from '@based/utils'
import {
  OnError,
  SubscriptionType,
} from '../client/query/subscription/types.js'
import { DbServer } from '../index.js'
import native from '../native.js'
import { ID } from '../client/query/toByteCode/offsets.js'

type OnData = (res: Uint8Array) => void

export type SubscriptionFullType = {
  query: Uint8Array
  listeners: Set<() => void>
}

export type SubscriptionId = {
  query: Uint8Array
  // nested: ,
  ids: Map<number, Set<OnData>>
  //   fullType: Set<number>
}

export type Subscriptions = {
  active: number
  updateHandler: ReturnType<typeof setTimeout>
  ids: Map<number, SubscriptionId>
  fullType: Map<number, Map<number, SubscriptionFullType>>
}

export const startUpdateHandler = (server: DbServer) => {
  // combine this with handled modify
  const scheduleUpdate = () => {
    const markedSubsR = native.getMarkedSubscriptions(server.dbCtxExternal)
    console.log('DERP', { markedSubsR })
    if (markedSubsR) {
      const x = new Uint8Array(markedSubsR)
      let i = 0
      for (; i < markedSubsR.byteLength; i += 8) {
        const subId = readUint32(x, i)
        const id = readUint32(x, i + 4)
        const subContainer = server.subscriptions.ids.get(subId)
        writeUint32(subContainer.query, id, ID.id)
        console.info('???????????????', subContainer)
        server.getQueryBuf(subContainer.query).then((res) => {
          const ids = subContainer.ids.get(id)
          if (ids) {
            ids.forEach((fn) => fn(res))
          }
        })
      }
    }
    // did modify ? yes schedule or something
    server.subscriptions.updateHandler = setTimeout(scheduleUpdate, 200)
  }
  server.subscriptions.updateHandler = setTimeout(scheduleUpdate, 200)
}

export const registerSubscription = (
  server: DbServer,
  query: Uint8Array,
  sub: Uint8Array,
  onData: OnData,
  onError?: OnError,
) => {
  let killed = false

  if (server.subscriptions.active === 0) {
    startUpdateHandler(server)
  }

  server.subscriptions.active++

  if (sub[0] === SubscriptionType.singleId) {
    const subId = readUint32(sub, 1)
    const id = readUint32(sub, 7)

    //   at the end of the sub we will store nested full type subs

    let subContainer: SubscriptionId
    let listeners: Set<OnData>

    if (!server.subscriptions.ids.get(subId)) {
      // copy query?
      subContainer = {
        query,
        ids: new Map(),
      }
      server.subscriptions.ids.set(subId, subContainer)
    } else {
      subContainer = server.subscriptions.ids.get(subId)
    }

    if (!subContainer.ids.has(id)) {
      listeners = new Set()
      subContainer.ids.set(id, listeners)
      console.log('add dat sub', sub)
      native.addIdSubscription(server.dbCtxExternal, sub)
    } else {
      listeners = subContainer.ids.get(id)
    }

    listeners.add(onData)

    // has to be wrapped in next tick preferebly - optmize later ofc
    process.nextTick(() => {
      server.getQueryBuf(query).then((res) => {
        console.log('yo???', res, query)
        // make this different!
        if (killed) {
          return
        }
        onData(res)
      })
    })

    return () => {
      console.log('close dat shit')
      killed = true
      listeners.delete(onData)

      if (listeners.size === 0) {
        native.removeIdSubscription(server.dbCtxExternal, sub)
        subContainer.ids.delete(id)
      }

      if (subContainer.ids.size === 0) {
        server.subscriptions.ids.delete(subId)
      }

      server.subscriptions.active--
      if (server.subscriptions.active === 0) {
        clearTimeout(server.subscriptions.updateHandler)
        server.subscriptions.updateHandler = null
      }
    }
  }

  return () => {}
}
