import { readUint16, readUint32, writeUint32 } from '@based/utils'
import {
  OnError,
  SubscriptionType,
} from '../client/query/subscription/types.js'
import { DbServer } from '../index.js'
import native from '../native.js'
import { ID } from '../client/query/toByteCode/offsets.js'

type OnData = (res: Uint8Array) => void

export type SubscriptionFullType = {
  listeners: Set<() => void>
}

export type SubscriptionId = {
  query: Uint8Array
  sub: Uint8Array
  ids: Map<number, Set<OnData>>
}

export type Subscriptions = {
  active: number
  updateHandler: ReturnType<typeof setTimeout>
  ids: Map<number, SubscriptionId>
  fullType: Map<number, SubscriptionFullType>
}

export const startUpdateHandler = (server: DbServer) => {
  // combine this with handled modify
  const scheduleUpdate = () => {
    // can do seperate timing for id / type
    // scince multi queries are much heavier ofc
    const markedIdSubs = native.getMarkedIdSubscriptions(server.dbCtxExternal)
    if (markedIdSubs) {
      const buffer = new Uint8Array(markedIdSubs)
      for (let i = 0; i < buffer.byteLength; i += 8) {
        const subId = readUint32(buffer, i)
        const id = readUint32(buffer, i + 4)
        const subContainer = server.subscriptions.ids.get(subId)
        writeUint32(subContainer.query, id, ID.id)
        server.getQueryBuf(subContainer.query).then((res) => {
          const ids = subContainer.ids.get(id)
          if (ids) {
            for (const fn of ids) {
              fn(res)
            }
          }
        })
      }
    }

    const markedMultiSubs = native.getMarkedMultiSubscriptions(
      server.dbCtxExternal,
    )
    if (markedMultiSubs) {
      const buffer = new Uint8Array(markedMultiSubs)
      for (let i = 0; i < buffer.byteLength; i += 2) {
        const typeId = readUint16(buffer, i)

        console.log('FLAP', typeId, server.subscriptions.fullType)

        const subs = server.subscriptions.fullType.get(typeId)
        if (subs) {
          console.log('DERP')
          for (const fn of subs.listeners) {
            fn()
          }
        }
      }
    }
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
    console.log('ADD ID SUB')

    const subId = readUint32(sub, 1)
    const id = readUint32(sub, 7)

    let subContainer: SubscriptionId
    let listeners: Set<OnData>

    if (!server.subscriptions.ids.get(subId)) {
      // copy query?
      subContainer = {
        query,
        sub,
        ids: new Map(),
      }
      server.subscriptions.ids.set(subId, subContainer)
    } else {
      subContainer = server.subscriptions.ids.get(subId)
    }

    if (!subContainer.ids.has(id)) {
      listeners = new Set()
      subContainer.ids.set(id, listeners)
      // later will be added where it gets the first result (and keep it up to date)
      native.addIdSubscription(server.dbCtxExternal, sub)
    } else {
      listeners = subContainer.ids.get(id)
    }

    listeners.add(onData)

    // has to be wrapped in next tick preferebly - optmize later ofc
    process.nextTick(() => {
      // here we can handle things like read the id etc
      // and then do first registration when its here
      server.getQueryBuf(query).then((res) => {
        // make this different!
        if (killed) {
          return
        }
        onData(res)
      })
    })

    return () => {
      killed = true
      listeners.delete(onData)
      if (listeners.size === 0) {
        native.removeIdSubscription(server.dbCtxExternal, sub)
        subContainer.ids.delete(id)
      }
      if (subContainer.ids.size === 0) {
        //  here we remove the full type attachments
        server.subscriptions.ids.delete(subId)
      }
      server.subscriptions.active--
      if (server.subscriptions.active === 0) {
        clearTimeout(server.subscriptions.updateHandler)
        server.subscriptions.updateHandler = null
      }
    }
  } else if (sub[0] === SubscriptionType.fullType) {
    console.log('ADD FULL TYPE SUB')

    const runQuery = () => {
      server.getQueryBuf(query).then((res) => {
        if (!killed) {
          onData(res)
        }
      })
    }

    const typeId = readUint16(sub, 1)
    let fullType: SubscriptionFullType
    let listeners: Set<() => void>
    if (!server.subscriptions.fullType.has(typeId)) {
      listeners = new Set()
      fullType = {
        listeners,
      }
      server.subscriptions.fullType.set(typeId, fullType)
      native.addMultiSubscription(server.dbCtxExternal, sub)
    } else {
      fullType = server.subscriptions.fullType.get(typeId)
      listeners = fullType.listeners
    }

    listeners.add(runQuery)

    runQuery()

    return () => {
      killed = true
      listeners.delete(runQuery)
      if (listeners.size === 0) {
        native.removeMultiSubscription(server.dbCtxExternal, sub)
        server.subscriptions.fullType.delete(typeId)
      }
      server.subscriptions.active--
      if (server.subscriptions.active === 0) {
        clearTimeout(server.subscriptions.updateHandler)
        server.subscriptions.updateHandler = null
      }
    }
  } else {
    throw new Error('Unhandled subscription!')
  }
}
