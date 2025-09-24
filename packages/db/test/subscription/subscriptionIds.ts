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
  const markedSubsR = native.getMarkedSubscriptions(server.dbCtxExternal)
  if (markedSubsR) {
    const markedSubs = new Uint8Array(markedSubsR)
    console.log('MARKED SUB:', markedSubsR)
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
    console.log('Subscriptions fired:', marked)
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

  // ----------------------------
  const fields = new Uint8Array([0, 1, 2])
  const subId = 66
  const typeId = server.schemaTypesParsed['user'].id
  // console.log(server.schemaTypesParsed.user.separate)

  const val = createSingleSubscriptionBuffer(subId, typeId, fields, id)
  native.addIdSubscription(server.dbCtxExternal, val)
  // ----------------------------

  const array = new Uint8Array(20)
  const l = write({ array } as Ctx, 'A', 0, false)

  // can make a proxy
  const payload = {
    derp: 99,
    x: 1,
    location: array.slice(0, l),
    lang: array.slice(0, l),
  }

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

  console.info(`------- ${readable} updates`)
  d = Date.now()
  for (let i = 0; i < amount; i++) {
    clients[1].update('user', i + 1, payload)
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

  console.info(
    `------- ${readable} updates  no active subs (all staged for updates)`,
  )
  d = Date.now()
  for (let i = 0; i < amount; i++) {
    clients[1].update('user', i + 1, payload)
  }
  dTime = await clients[1].drain()
  console.log(
    `handling ${readable} updates /w snoozed subs`,
    Date.now() - d,
    'ms',
    'drain time (real db)',
    dTime,
    'ms',
  )
  logSubIds(server)

  for (let i = 0; i < amount; i++) {
    clients[1].create('control', payload)
  }
  await clients[1].drain()
  console.info(`------- ${readable} updates control`)
  d = Date.now()
  for (let i = 0; i < amount; i++) {
    clients[1].update('control', i + 1, payload)
  }
  dTime = await clients[1].drain()
  console.log(
    `handling ${readable} updates with CONTROL (zero subs)`,
    Date.now() - d,
    'ms',
    'drain time (real db)',
    dTime,
    'ms',
  )

  // const close = clients[1]
  //   .query('user', id)
  //   .include('derp')
  //   .subscribe((q) => {
  //     console.log('#0 YO UPDATE id 1 on client 0', q)
  //     cnt++
  //   })

  // for (let i = 0; i < 1e6; i++) {
  //   clients[0].create('user', { derp: i })
  // }

  // await clients[0].drain()
  // console.info('------- UPDATE')
  // await clients[1].update('user', id, { derp: 69 })
  // await wait(100)
  // logSubIds(server)

  // if the same dont!
  // console.info('------- UPDATE 2')
  // // await clients[1].update('user', id, { derp: 69 })
  // await clients[1].update('user', id, { derp: 70 })
  // await wait(100)
  // logSubIds(server)

  // console.info('------- UPDATE 3')
  // // await clients[1].update('user', id, { derp: 69 })
  // await clients[1].update('user', id, { derp: 71 })
  // await wait(100)
  // logSubIds(server)

  // native.removeIdSubscription(server.dbCtxExternal, val)

  // console.info('------- 1M updates')
  // let d = Date.now()
  // for (let i = 0; i < 1e6; i++) {
  //   await clients[1].update('user', i + 1, { derp: 72 })
  // }
  // await clients[0].drain()
  // console.log('1M d', Date.now() - d, 'ms')
  // logSubIds(server)

  // ----------
  // native.removeIdSubscription(server.dbCtxExternal, val)
  // console.info('------- UPDATE 4 after remove of sub (no marked)')
  // // await clients[1].update('user', id, { derp: 69 })
  // await clients[1].update('user', id, { derp: 73 })
  // await wait(100)
  // logSubIds(server)

  // const close2 = clients[0]
  //   .query('user', id)
  //   .include('derp')
  //   .subscribe((q) => {
  //     console.log('#1 YO UPDATE id 1 on client 1', q)
  //     cnt++
  //   })

  // console.info('------- UPDATE 5 after remove of node')
  // native.addIdSubscription(server.dbCtxExternal, val)
  // // await clients[1].update('user', id, { derp: 69 })
  // await clients[1].delete('user', id)
  // await wait(100)
  // logSubIds(server)

  // await wait(100)

  // 1M subs - pretty fast....
  // only thing we need in the client is subs[id]
  // prob make a map there with 2 fields -1 field ids -1 field multi
  // const c = clients[1]
  // const allUsersRange = await c.query('user').include('derp').get()

  // ----------------------------
  // const id = await clients[0].create('user', { derp: 66 })
  // const multiSubId = 99
  // const typeId = server.schemaTypesParsed['user'].id
  // ----------------------------
  // const headerLen =

  // const fields = new Uint8Array([0])
  // val.set(fields, headerLen)

  // console.log('\n=============MULTI TIME')
  // const q = c.query('user').include('derp').range(0, 10)
  // let x = await q.get()
  // let n = x.toObject()

  // const val2 = new Uint8Array(22 + fields.byteLength)
  // writeUint32(val2, multiSubId, 0)
  // writeUint16(val2, typeId, 8)
  // console.log('id:', n[0], n[n.length - 1])
  // val2[10] = TYPE_INDEX_MAP.id
  // writeUint32(val2, n[0].id, 11)
  // writeUint32(val2, n[n.length - 1].id, 15)

  // // hasFullRange
  // val2[19] = 1
  // // filterLen
  // val2[20] = 0
  // val2[21] = 0

  // // const fields = new Uint8Array([0])
  // val2.set(fields, 22)

  // native.addMultiSubscription(server.dbCtxExternal, val2)

  // console.info('------- UPDATE FOR MULTI after remove of sub (no marked)')
  // // await clients[1].update('user', id, { derp: 69 })
  // await clients[1].update('user', 3, { derp: 72 })

  // logSubIds(server)

  // console.log('derp?')
  // logSubIds(server)

  // await clients[1].update('user', 3, { derp: 72 })
  // logSubIds(server)

  // console.info('------- 1M updates multi updates')
  // d = Date.now()
  // for (let i = 1e6; i > 0; i--) {
  //   await clients[1].update('user', i + 1, { derp: 72 })
  // }
  // await clients[0].drain()
  // console.log('1M multi d', Date.now() - d, 'ms')
  // logSubIds(server)

  // console.log('CREATE!')
  // await clients[1].create('user', { derp: 72 })
  // logSubIds(server)

  // console.log('REMOVE!')
  // await clients[1].delete('user', 3)
  // logSubIds(server)

  // x = await q.get()
  // n = x.toObject()
  // writeUint32(val2, n[0].id, 11)
  // writeUint32(val2, n[n.length - 1].id, 15)
  // update range index
  // native.addMultiSubscription(server.dbCtxExternal, val2)
  // await clients[1].update('user', n[n.length - 1].id, { derp: 77 })
  // logSubIds(server)

  // console.info('=-===REMOVE SUBS')
  // native.removeIdSubscription(server.dbCtxExternal, val)

  // native.removeMultiSubscription(server.dbCtxExternal, val2)

  // await clients[1].update('user', n[n.length - 1].id, { derp: 666 })
  // logSubIds(server)

  // console.log('========FILTER')
  // const q2 = c.query('user').filter('derp', '=', 666)
  // x = await q2.get()
  // n = x.toObject()
  // console.log(n)

  // only for very simple filters to start?
  // const filterBuf = filterToBuffer(q2.def.filter)
  // console.log({ filterBuf })

  // const filterLen = 0 //filterBuf.byteLength

  // const val3 = new Uint8Array(22 + filterLen + fields.byteLength)
  // writeUint32(val3, multiSubId, 0)
  // writeUint16(val3, typeId, 8)
  // console.log('id:', n[0], n[n.length - 1])
  // val2[10] = TYPE_INDEX_MAP.id
  // writeUint32(val2, n[0].id, 11)
  // writeUint32(val2, n[n.length - 1].id, 15)
  // put this in
  // console.log(q2.def.filter, q2.def.filter.conditions.get(0))
  // ADD FIELDS so you know this field is included
  // hasFullRange
  // val2[19] = 0
  // writeUint16(val, filterLen, 20)
  // val2.set(fields, 22 + filterLen)
  // native.addMultiSubscription(server.dbCtxExternal, val2)

  // exception hasFullRange id > (dont need to evaluate anything)
  // if id < start yes do need to eval

  // add IDS[] as single id subs if its not a range - if its a perfect range just use multi

  // try create with id range where the range is not full

  // if id remove <= endID update all
  // if create and !hasComplete (extra flag on thing) rerun

  // then filters ofc

  // then sort

  // can add more optmization with LANGCODE for both single id and multi id

  // range first

  // filter + conditions
  // get range keep track of last id OR last sort value
  // if > lastId ignore if < firstId - ignore
  // this works very well for ids subs
  // and this can be sort as well
  // range[TYPEINDEX][start][end]
  // id = 255

  // need to include the filter for the field

  // close()
  // close2()
})
