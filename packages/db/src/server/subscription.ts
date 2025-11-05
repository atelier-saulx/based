import { readUint16, readUint32 } from '@based/utils'
import {
  OnError,
  SubscriptionType,
} from '../client/query/subscription/types.js'
import { DbServer } from '../index.js'
import native from '../native.js'
import { MAX_ID } from '@based/schema'

type OnData = (res: Uint8Array) => void

export type SubscriptionFullType = {
  listeners: Set<() => void>
}

export type SubscriptionId = {
  ids: Map<number, Set<() => void>>
}

export type Subscriptions = {
  updateId: number
  active: number
  updateHandler: ReturnType<typeof setTimeout>
  ids: Map<number, SubscriptionId>
  fullType: Map<number, SubscriptionFullType>
}

export const startUpdateHandler = (server: DbServer) => {
  // combine this with handled modify
  const scheduleUpdate = () => {
    server.subscriptions.updateId++
    if (server.subscriptions.updateId > MAX_ID) {
      server.subscriptions.updateId = 1
    }
    // can do seperate timing for id / type
    // scince multi queries are much heavier ofc
    const markedIdSubs = native.getMarkedIdSubscriptions(server.dbCtxExternal)
    if (markedIdSubs) {
      const buffer = new Uint8Array(markedIdSubs)
      for (let i = 0; i < buffer.byteLength; i += 8) {
        const subId = readUint32(buffer, i)
        const id = readUint32(buffer, i + 4)
        const subContainer = server.subscriptions.ids.get(subId)
        const ids = subContainer.ids.get(id)
        if (ids) {
          for (const fn of ids) {
            fn()
          }
        }
      }
    }

    const markedMultiSubs = native.getMarkedMultiSubscriptions(
      server.dbCtxExternal,
    )
    if (markedMultiSubs) {
      const buffer = new Uint8Array(markedMultiSubs)
      for (let i = 0; i < buffer.byteLength; i += 2) {
        const typeId = readUint16(buffer, i)
        const subs = server.subscriptions.fullType.get(typeId)
        if (subs) {
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

  let lastUpdated = 0

  const runQuery = () => {
    if (lastUpdated !== server.subscriptions.updateId) {
      lastUpdated = server.subscriptions.updateId
      server.getQueryBuf(query).then((res) => {
        if (!killed) {
          onData(res)
        }
      })
    }
  }

  server.subscriptions.active++

  if (sub[0] === SubscriptionType.singleId) {
    const subId = readUint32(sub, 1)
    const id = readUint32(sub, 7)
    let subContainer: SubscriptionId
    let listeners: Set<() => void>
    if (!server.subscriptions.ids.get(subId)) {
      subContainer = { ids: new Map() }
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
    listeners.add(runQuery)
    // has to be wrapped in next tick preferebly - optmize later ofc
    process.nextTick(() => {
      runQuery()
    })
    return () => {
      killed = true
      listeners.delete(runQuery)
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
    process.nextTick(() => {
      runQuery()
    })
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
