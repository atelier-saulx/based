import { readUint32, wait, writeUint16, writeUint32 } from '@based/utils'
import { DbClient } from '../../src/client/index.js'
import { DbServer } from '../../src/server/index.js'
import test from '../shared/test.js'
import { getDefaultHooks } from '../../src/hooks.js'
import native from '../../src/native.js'
import { BasedDb } from '../../src/index.js'

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

  const payload: any = {
    derp: 99,
    x: 1,
  }

  const updateAll = async (type = 'user') => {
    let d = Date.now()
    for (let i = 0; i < 2e6; i++) {
      payload.derp = i
      payload.x = i % 255
      // payload.location = 'x ' + i
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

  const removeubsForId = (subId: number, id: number) => {
    let d = Date.now()
    const val = new Uint8Array(10)
    const typeId = server.schemaTypesParsed['user'].id
    writeUint32(val, id, 0)
    writeUint32(val, subId, 4)
    writeUint16(val, typeId, 8)
    native.removeIdSubscription(server.dbCtxExternal, val)
    console.log(`Remove subscriptions ${subId} ${id} `, Date.now() - d, 'ms')
  }

  // different
  const addSubs = (subId: number, start = 0, end = 1000): Uint8Array => {
    const fields = new Uint8Array([0, 1, 2])
    const typeId = server.schemaTypesParsed['user'].id
    const val = createSingleSubscriptionBuffer(subId, typeId, fields, 1)
    let d = Date.now()
    for (let i = start; i < end; i++) {
      writeUint32(val, i, 6)
      native.addIdSubscription(server.dbCtxExternal, val)
    }
    console.log('  Add all those subs ', Date.now() - d, 'ms')
    return val
  }

  // this is single type ofc
  type Subs = {
    idsSubSize: number
    idsAmount: number
    // ids:
    // bitSetSize
    subs: {
      [subId: string]: Uint8Array
    }
    // want to sort by number
    ids: {
      [id: string]: number[]
    }
  }

  const addAllSubs = (subs: Subs) => {
    const idsList = new Uint32Array(subs.idsAmount)
    const idsSubs = new Uint8Array(subs.idsSubSize)
    let cnt = 0
    let i = 0
    for (const id in subs.ids) {
      const idNr = Number(id)
      idsList[cnt] = idNr
      writeUint32(idsSubs, idNr, i)
      i += 4
      const subI = subs.ids[id]
      for (const sub of subI) {
        const s = subs.subs[sub]
        writeUint32(s, idNr, 4)
        idsSubs.set(s, i)
        i += 24
      }
      cnt++
    }
    idsList.sort()
    return { idsList, idsSubs }
  }

  const addSubsJS = (subs: Subs, subId: number, start = 0, end = 1000) => {
    const fields = new Uint8Array(16)
    fields.fill(254)
    fields[0] = 0
    fields[1] = 1
    fields[2] = 2
    const typeId = server.schemaTypesParsed['user'].id
    const val = new Uint8Array(24)
    subs.subs[subId] = val
    let d = Date.now()
    for (let i = start; i < end; i++) {
      const id = i
      if (!subs.ids[id]) {
        subs.idsSubSize += 4
        subs.idsAmount += 1
        subs.ids[id] = [subId]
      } else {
        subs.ids[id].push(subId)
      }
      subs.idsSubSize += 24 // fields + 8 overhead
    }
  }

  const subsJS: Subs = { ids: {}, subs: {}, idsAmount: 0, idsSubSize: 0 }
  let xxx = Date.now()

  addSubsJS(subsJS, 666, 1, 2e6 - 2)
  addSubsJS(subsJS, 420, 1, 2e6 - 2)

  console.log(Date.now() - xxx, 'JS MAKE MAKE MS')

  xxx = Date.now()
  addAllSubs(subsJS)
  console.log(Date.now() - xxx, 'JS PREP BUFFERS')

  let BLA = Date.now()

  // native.addMultiSubscription(
  //   server.dbCtxExternal,
  //   createSingleSubscriptionBuffer(
  //     6,
  //     server.schemaTypesParsed.user.id,
  //     new Uint8Array([0, 1]),
  //     2,
  //   ),
  // )

  console.log('ZIG ZAG', Date.now() - BLA, 'ms')

  for (let i = 0; i < amount; i++) {
    clients[0].create('user', { x: i % 255 })
  }

  console.log('create', await clients[0].drain(), 'ms')

  let d = Date.now()
  // addSubs(666, 1, 2e6 - 2)
  // addSubs(420, 1, 2e6 - 2)
  addSubs(666, 198, 199)
  console.log('REST 1------------')

  addSubs(666, 1, 2)

  console.log('REST 2------------')

  addSubs(666, 20e6 - 10e3, 20e6 - 10e3 + 1)

  console.log('REST 3------------')
  addSubs(666, 10e6 - 2, 10e6 - 1)
  addSubs(666, 500, 501)
  addSubs(999, 500, 501)

  addSubs(666, 0, 2e6)

  console.log(Date.now() - d, 'ms', 'to create 4M')

  d = Date.now()

  // removeubsForId(666, 500)
  // removeubsForId(666, 10e6 - 2)
  // removeubsForId(666, 20e6 - 2)
  // removeubsForId(999, 500)

  console.log(Date.now() - d, 'ms', 'to remove subs...')

  // addSubs(666, 1, 2e6 - 1)
  // addSubs(777, 1, 2e6 - 1)

  await updateAll()

  await clients[0].query('user').range(0, 2e6).get().inspect()

  const markedSubsR = native.getMarkedSubscriptions(server.dbCtxExternal)
  console.log({ markedSubsR })

  await wait(100)
})
