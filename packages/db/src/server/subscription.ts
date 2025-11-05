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
  types?: Uint16Array
  ids: Map<number, Set<() => void>>
  typesListener?: () => void
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

const addToMultiSub = (
  server: DbServer,
  typeId: number,
  runQuery: () => void,
) => {
  let fullType: SubscriptionFullType
  let listeners: Set<() => void>
  if (!server.subscriptions.fullType.has(typeId)) {
    listeners = new Set()
    fullType = {
      listeners,
    }
    server.subscriptions.fullType.set(typeId, fullType)
    native.addMultiSubscription(server.dbCtxExternal, typeId)
  } else {
    fullType = server.subscriptions.fullType.get(typeId)
    listeners = fullType.listeners
  }
  listeners.add(runQuery)
}

const removeFromMultiSub = (
  server: DbServer,
  typeId: number,
  runQuery: () => void,
) => {
  const typeSub = server.subscriptions.fullType.get(typeId)
  if (!typeSub) {
    return
  }
  typeSub.listeners.delete(runQuery)
  if (typeSub.listeners.size === 0) {
    native.removeMultiSubscription(server.dbCtxExternal, typeId)
    server.subscriptions.fullType.delete(typeId)
  }
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
    } else {
      console.log('Allready fired block')
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
      const typesLen = readUint16(sub, 12)
      if (typesLen > 0) {
        const fLen = sub[11]
        subContainer.types = new Uint16Array(
          sub.buffer,
          sub.byteOffset + 14 + fLen,
          typesLen,
        )
        subContainer.typesListener = () => {
          for (const set of subContainer.ids.values()) {
            for (const fn of set) {
              fn()
            }
          }
        }
        for (const typeId of subContainer.types) {
          addToMultiSub(server, typeId, subContainer.typesListener)
        }
      }
    } else {
      subContainer = server.subscriptions.ids.get(subId)
    }
    if (!subContainer.ids.has(id)) {
      listeners = new Set()
      subContainer.ids.set(id, listeners)
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
        if (subContainer.types) {
          for (const typeId of subContainer.types) {
            removeFromMultiSub(server, typeId, subContainer.typesListener)
          }
        }
        server.subscriptions.ids.delete(subId)
      }
      server.subscriptions.active--
      if (server.subscriptions.active === 0) {
        clearTimeout(server.subscriptions.updateHandler)
        server.subscriptions.updateHandler = null
        console.log(server.subscriptions, 'SHOULD BE EMPTY')
      }
    }
  } else if (sub[0] === SubscriptionType.fullType) {
    const typeId = readUint16(sub, 1)

    addToMultiSub(server, typeId, runQuery)

    process.nextTick(() => {
      runQuery()
    })
    return () => {
      killed = true
      removeFromMultiSub(server, typeId, runQuery)
      server.subscriptions.active--
      if (server.subscriptions.active === 0) {
        clearTimeout(server.subscriptions.updateHandler)
        server.subscriptions.updateHandler = null
        console.log(server.subscriptions, 'SHOULD BE EMPTY')
      }
    }
  } else {
    throw new Error('Unhandled subscription!')
  }
}
