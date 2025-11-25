import {
  readInt64,
  readUint16,
  readUint32,
  writeInt64,
} from '../utils/index.js'
import {
  OnError,
  SubscriptionType,
} from '../client/query/subscription/types.js'
import { DbServer } from '../index.js'
import native from '../native.js'
import { styleText } from 'util'
import { MAX_ID } from '../schema/index.js'

type OnData = (res: Uint8Array) => void

export type SubscriptionFullType = {
  listeners: Set<() => void>
}

export type SubscriptionNow = {
  lastEval: number
  next: number
  listeners: Set<() => void>
}

export type SubscriptionId = {
  types?: Uint16Array
  ids: Map<number, Set<() => void>>
  typesListener?: () => void
  nowListener?: () => void
}

export type Subscriptions = {
  updateId: number
  active: number
  updateHandler: ReturnType<typeof setTimeout> | null
  ids: Map<number, SubscriptionId>
  fullType: Map<number, SubscriptionFullType>
  now: { listeners: Set<() => void>; lastUpdated: number }
  subInterval: number // can change based on load
}

export const startUpdateHandler = (server: DbServer) => {
  // skip next if queries are sitll in progress can add a number for each staged sub

  // combine this with handled modify
  const scheduleUpdate = () => {
    if (server.stopped) {
      return
    }
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
        const id = readUint32(buffer, i)
        const subId = readUint32(buffer, i + 4)
        const subContainer = server.subscriptions.ids.get(subId)
        if (subContainer) {
          const ids = subContainer.ids.get(id)
          if (ids) {
            for (const fn of ids) {
              fn()
            }
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

    if (
      server.subscriptions.updateId - server.subscriptions.now.lastUpdated >
      Math.max(1000 / server.subscriptions.subInterval, 1) // 1 time per second
    ) {
      server.subscriptions.now.lastUpdated = server.subscriptions.updateId
      for (const fn of server.subscriptions.now.listeners) {
        fn()
      }
    }

    server.subscriptions.updateHandler = setTimeout(
      scheduleUpdate,
      server.subscriptions.subInterval,
    )
  }
  server.subscriptions.updateHandler = setTimeout(
    scheduleUpdate,
    server.subscriptions.subInterval,
  )
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
    fullType = server.subscriptions.fullType.get(typeId)!
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

const replaceNowValues = (query: Uint8Array, now: Uint8Array) => {
  const dateNow = Date.now()
  for (let i = 0; i < now.byteLength; i += 16) {
    const offset = readInt64(now, i + 4)
    const byteIndex = readUint32(now, i + 12)
    writeInt64(query, dateNow + offset, byteIndex)
  }
}

export const registerSubscription = (
  server: DbServer,
  query: Uint8Array,
  sub: Uint8Array,
  onData: OnData,
  onError: OnError,
  subInterval?: number,
) => {
  if (subInterval) {
    server.subscriptions.subInterval = subInterval
  }
  let killed = false

  if (server.subscriptions.active === 0) {
    startUpdateHandler(server)
  }

  let lastUpdated = 0
  let now: Uint8Array

  const runQuery = () => {
    if (lastUpdated !== server.subscriptions.updateId) {
      lastUpdated = server.subscriptions.updateId
      if (now) {
        replaceNowValues(query, now)
      }
      let d = Date.now()
      server.getQueryBuf(query).then((res) => {
        if (killed) {
          return
        }
        // total++
        // exectime += Date.now() - d
        if (res.byteLength >= 4) {
          onData(res)
        } else if (res.byteLength === 1 && res[0] === 0) {
          server.emit(
            'info',
            `Subscribe schema mismatch - should resolve after update`,
          )
          return
        } else {
          let name = styleText('red', `QueryError[]\n`)
          name += `  Incorrect buffer received in subscription (maybe server not started ${res.byteLength}) bytes\n`
          onError(new Error(name))
        }
      })
    } else {
      // console.log('Allready fired block')
    }
  }

  server.subscriptions.active++

  if (sub[0] === SubscriptionType.singleId) {
    const subId = readUint32(sub, 1)
    const id = readUint32(sub, 7)
    const headerLen = 18
    let subContainer: SubscriptionId
    let listeners: Set<() => void>
    if (!server.subscriptions.ids.get(subId)) {
      subContainer = { ids: new Map() }
      server.subscriptions.ids.set(subId, subContainer)
      const fLen = sub[11]
      const mainLen = readUint16(sub, 12) * 2
      const typesLen = readUint16(sub, 14)
      const nowLen = readUint16(sub, 16)

      if (typesLen != 0) {
        // double check if this is alignment correct with the byteOffset else copy
        const byteOffset = sub.byteOffset + headerLen + fLen + mainLen
        if (byteOffset % 2 === 0) {
          subContainer.types = new Uint16Array(sub.buffer, byteOffset, typesLen)
        } else {
          subContainer.types = new Uint16Array(
            sub.slice(
              headerLen + fLen + mainLen,
              headerLen + fLen + mainLen + typesLen * 2,
            ),
          )
        }
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
      if (nowLen != 0) {
        // when this is the case do a completely different strategy
        // keep track of last update on sub id container
        // and get the date allways (as a seperate query)
        // when getting the date mark next in line

        // have to make a copy (subArray is weak)
        now = sub.slice(headerLen + fLen + mainLen + typesLen * 2)
        subContainer.nowListener = () => {
          // per id want to have a last eval and needs next eval

          for (const set of subContainer.ids.values()) {
            for (const fn of set) {
              fn()
            }
          }
        }
        server.subscriptions.now.listeners.add(subContainer.nowListener)
      }
    } else {
      subContainer = server.subscriptions.ids.get(subId)!
    }
    if (!subContainer.ids.has(id)) {
      listeners = new Set()
      subContainer.ids.set(id, listeners)
      native.addIdSubscription(server.dbCtxExternal, sub)
    } else {
      listeners = subContainer.ids.get(id)!
    }
    listeners.add(runQuery)

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
            removeFromMultiSub(server, typeId, subContainer.typesListener!)
          }
        }
        if (now) {
          server.subscriptions.now.listeners.delete(subContainer.nowListener!)
        }
        server.subscriptions.ids.delete(subId)
      }
      server.subscriptions.active--
      if (server.subscriptions.active === 0) {
        clearTimeout(server.subscriptions.updateHandler!)
        server.subscriptions.updateHandler = null
      }
    }
  } else if (sub[0] === SubscriptionType.fullType) {
    const headerLen = 8
    const typeId = readUint16(sub, 1)
    addToMultiSub(server, typeId, runQuery)
    const typesLen = readUint16(sub, 3)
    let types: Uint16Array
    if (typesLen != 0) {
      // double check if this is alignment correct with the byteOffset else copy
      const byteOffset = sub.byteOffset + headerLen
      if (byteOffset % 2 === 0) {
        types = new Uint16Array(sub.buffer, byteOffset, typesLen)
      } else {
        types = new Uint16Array(sub.slice(headerLen, headerLen + typesLen * 2))
      }
      for (const typeId of types) {
        addToMultiSub(server, typeId, runQuery)
      }
    }

    if (readUint16(sub, 5) != 0) {
      // have to make a copy (subArray is weak)
      now = sub.slice(headerLen + typesLen * 2)
      server.subscriptions.now.listeners.add(runQuery)
    }

    process.nextTick(() => {
      runQuery()
    })

    return () => {
      killed = true
      if (now) {
        server.subscriptions.now.listeners.delete(runQuery)
      }
      removeFromMultiSub(server, typeId, runQuery)
      if (types) {
        for (const typeId of types) {
          removeFromMultiSub(server, typeId, runQuery)
        }
      }
      server.subscriptions.active--
      if (server.subscriptions.active === 0) {
        clearTimeout(server.subscriptions.updateHandler!)
        server.subscriptions.updateHandler = null
      }
    }
  } else {
    throw new Error('Unhandled subscription!')
  }
}
