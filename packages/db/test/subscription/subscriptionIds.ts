import {
  makeTmpBuffer,
  readUint32,
  readUint64,
  wait,
  writeUint16,
  writeUint32,
  writeUint64,
} from '@based/utils'
import { DbClient } from '../../src/client/index.js'
import { DbServer } from '../../src/server/index.js'
import test from '../shared/test.js'
import { getDefaultHooks } from '../../src/hooks.js'
import native from '../../src/native.js'
import { BasedDb, filterToBuffer } from '../../src/index.js'
import { TYPE_INDEX_MAP } from '@based/schema/def'
import { write } from '../../src/client/string.js'
import { Ctx } from '../../src/client/modify/Ctx.js'

// make multi thread

const start = async (t, clientsN = 2) => {
  const server = new DbServer({
    path: t.tmp,
  })
  const clients = Array.from({ length: clientsN }).map(
    () =>
      new DbClient({
        hooks: getDefaultHooks(server, 100),
      }),
  )
  await server.start({ clean: true })
  t.after(() => server.destroy())
  return { clients, server }
}

type Marked = { ids: number[]; id: number }

const logSubIds = (server: BasedDb['server']) => {
  let d = Date.now()
  const markedSubsR = native.getMarkedSubscriptions(server.dbCtxExternal)
  d = Date.now() - d
  if (markedSubsR) {
    const markedSubs = new Uint8Array(markedSubsR)
    // console.log('MARKED SUB:', markedSubsR)
    const marked: { [subId: number]: Marked } = {}
    let i = 0
    while (i < markedSubs.byteLength) {
      const subId = readUint32(markedSubs, i)
      const id = readUint32(markedSubs, i + 4)
      if (!marked[subId]) {
        marked[subId] = { id: subId, ids: [] }
      }
      marked[subId].ids.push(id)
      i += 8
    }
    const uniq = new Set()
    const results: { ids: number; subs: number; uniqIds: number } = {
      ids: 0,
      subs: 0,
      uniqIds: 0,
    }
    for (const key in marked) {
      const v = marked[key]
      for (const x of v.ids) {
        uniq.add(x)
      }
      results.subs++
      results.ids += v.ids.length
    }
    results.uniqIds = uniq.size
    console.log(`   • Subscriptions fired ${d}ms:`, results)
  } else {
    console.log('   • No subs fired!')
  }
}

const createSingleSubscriptionBuffer = (
  subId: number,
  typeId: number,
  fields: Uint8Array,
  id: number,
) => {
  const headerLen = 10
  let val = new Uint8Array(headerLen + fields.byteLength)
  writeUint32(val, subId, 0)
  writeUint16(val, typeId, 4)
  writeUint32(val, id, 6)
  val.set(fields, headerLen)
  return val
}

// make a tool to test subs
await test('subscriptionIds', async (t) => {
  const clientsN = 2
  const { clients, server } = await start(t, clientsN)

  await clients[0].setSchema({
    types: {
      user: {
        x: 'uint8',
        derp: 'uint32',
        location: 'string',
        lang: 'string',
      },
      control: {
        x: 'uint8',
        derp: 'uint32',
        location: 'string',
        lang: 'string',
        // add text
      },
    },
  })

  const amount = 2e6
  const readable =
    amount > 1e6
      ? Math.round(amount / 1e6) + 'M'
      : amount > 1e3
        ? Math.round(amount / 1e3) + 'K'
        : amount

  const id = await clients[0].create('user', { derp: 66 })

  const array = new Uint8Array(20)
  const l = write({ array } as Ctx, 'A', 0, false)

  const payload = {
    derp: 99,
    x: 1,
    // location: array.slice(0, l),
    // lang: array.slice(0, l),
  }

  const updateAll = async (type = 'user') => {
    let d = Date.now()
    for (let i = 0; i < amount; i++) {
      payload.derp = i
      payload.x = i % 255
      clients[1].update(type, i + 1, payload)
    }
    let dTime = await clients[1].drain()
    console.log(
      `handling ${readable} updates with unique subs firing`,
      Date.now() - d,
      'ms',
      'drain time (real db)',
      dTime,
      'ms',
    )
  }

  const removeAllSubsForId = (val: Uint8Array) => {
    let d = Date.now()
    for (let i = 1; i < amount; i++) {
      writeUint32(val, i, 10)
      native.removeIdSubscription(server.dbCtxExternal, val)
    }
    console.log(`Remove subscriptions ${readable} subs`, Date.now() - d, 'ms')
  }

  const addSubs = (subId: number, start = 0, end = 1000): Uint8Array => {
    const fields = new Uint8Array([0, 1, 2])
    const typeId = server.schemaTypesParsed['user'].id
    const val = createSingleSubscriptionBuffer(subId, typeId, fields, id)
    let d = Date.now()
    for (let i = start; i < end; i++) {
      writeUint32(val, ~~(Math.random() * amount * 5) + 1, 6)
      native.addIdSubscription(server.dbCtxExternal, val)
    }
    // console.log(`#1 add ${readable} subs sub:(${subId})`, Date.now() - d, 'ms')
    return val
  }

  let BLA = Date.now()

  native.addMultiSubscription(
    server.dbCtxExternal,
    createSingleSubscriptionBuffer(6, 2, new Uint8Array([0, 1]), 2),
  )
  console.log('ZIG ZAG', Date.now() - BLA, 'ms')

  const x = Date.now()
  //100000
  const shurp = {}
  for (let i = 1; i < 100e6; i++) {
    shurp[i] = true
    // if (i % 4) {
    //   shurp[i + ~~(Math.random() * 10e6)] = i < 1e5
    // }
    // if (i % 3) {
    //   shurp[20e6 + i] = false
    // }
  }
  shurp[20e6 - 1] = true

  // const bla = new Uint8Array(2e6)
  BLA = Date.now()
  let cnt = 0
  for (let i = 1; i < 25e6; i++) {
    if (shurp[i]) {
      cnt++
    }
  }

  // shurp[20e6 - 10] = true

  console.log(
    '!!!!!!!',
    Date.now() - BLA,
    'ms',
    cnt,
    'all',
    Date.now() - x,
    'ms',
  )

  //   for (let i = 1; i < 2e6; i++) {
  //   addSubs(i)
  // }

  // await updateAll()
  // logSubIds(server)

  // await updateAll()
  // await updateAll()
  // logSubIds(server)

  // await updateAll()
  // await updateAll()
  // logSubIds(server)

  // await updateAll()
  // await updateAll()
  // logSubIds(server)

  // await updateAll()
  // await updateAll()
  // logSubIds(server)

  // removeAllSubsForId(val)
  // await updateAll()
  // await updateAll()
  // logSubIds(server)

  // removeAllSubsForId(val2)
  // await updateAll()
  // await updateAll()
  // logSubIds(server)
})
