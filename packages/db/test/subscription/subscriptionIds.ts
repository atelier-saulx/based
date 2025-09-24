import {
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

type Marked = { type: 0 | 1; ids?: Uint32Array; id: number }

const logSubIds = (server: BasedDb['server']) => {
  let d = Date.now()
  const markedSubsR = native.getMarkedSubscriptions(server.dbCtxExternal)
  d = Date.now() - d
  if (markedSubsR) {
    const markedSubs = new Uint8Array(markedSubsR)
    // console.log('MARKED SUB:', markedSubsR)
    const marked: Marked[] = []
    let i = 0
    while (i < markedSubs.byteLength) {
      const isId = markedSubs[i] === 255
      i++
      if (isId) {
        const m: Marked = { id: readUint64(markedSubs, i), type: 1 }
        i += 8
        const len = readUint32(markedSubs, i)
        m.ids = new Uint32Array(len)
        i += 4
        for (let j = 0; j < len; j++) {
          m.ids[j] = readUint32(markedSubs, i)
          i += 4
        }
        m.ids.sort() // not nessecary in prod just to see
        marked.push(m)
      } else {
        marked.push({ id: readUint64(markedSubs, i), type: 0 })
        i += 8
      }
    }
    console.log(
      `   • Subscriptions fired ${d}ms:`,
      marked.map((v) => ({ ids: v.ids.length, sub: v.id })),
    )
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
  const headerLen = 14
  let val = new Uint8Array(headerLen + fields.byteLength)
  writeUint64(val, subId, 0)
  writeUint16(val, typeId, 8)
  writeUint32(val, id, 10)
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
    location: array.slice(0, l),
    lang: array.slice(0, l),
  }

  const updateAll = async (type = 'user') => {
    d = Date.now()
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
    d = Date.now()
    for (let i = 1; i < amount; i++) {
      writeUint32(val, i, 10)
      native.removeIdSubscription(server.dbCtxExternal, val)
    }
    console.log(
      `Remove subscriptions ${readable} subs sub:(${subId})`,
      Date.now() - d,
      'ms',
    )
  }

  // -----------------------------------
  const fields = new Uint8Array([0, 1, 2])
  const subId = 66
  const typeId = server.schemaTypesParsed['user'].id
  const val = createSingleSubscriptionBuffer(subId, typeId, fields, id)
  native.addIdSubscription(server.dbCtxExternal, val)

  console.log('single UPDATE #1')
  await clients[1].update('user', id, payload)
  logSubIds(server)
  let d = Date.now()
  for (let i = 1; i < amount; i++) {
    writeUint32(val, i, 10)
    native.addIdSubscription(server.dbCtxExternal, val)
  }
  console.log(`#1 add ${readable} subs sub:(${subId})`, Date.now() - d, 'ms')
  d = Date.now()
  const secondSubId = 11
  const val2 = createSingleSubscriptionBuffer(
    secondSubId,
    typeId,
    new Uint8Array([0]),
    id,
  )
  for (let i = 1; i < amount; i++) {
    writeUint32(val2, i, 10)
    native.addIdSubscription(server.dbCtxExternal, val2)
  }
  console.log(
    `#2 add second sub:(${secondSubId}) ${readable} subs`,
    Date.now() - d,
    'ms',
  )
  for (let i = 0; i < amount; i++) {
    clients[1].create('user', payload)
  }
  await clients[1].drain()
  // ----------------- HERE --------------

  logSubIds(server)

  await updateAll()
  await updateAll()
  logSubIds(server)

  await updateAll()
  await updateAll()
  logSubIds(server)

  await updateAll()
  await updateAll()
  logSubIds(server)

  await updateAll()
  await updateAll()
  logSubIds(server)

  await updateAll()
  await updateAll()
  logSubIds(server)

  removeAllSubsForId(val)
  await updateAll()
  await updateAll()
  logSubIds(server)

  removeAllSubsForId(val2)
  await updateAll()
  await updateAll()
  logSubIds(server)
})
