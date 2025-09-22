import {
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
import { BasedDb } from '../../src/index.js'
import { TYPE_INDEX_MAP } from '@based/schema/def'

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

const logSubIds = (server: BasedDb['server']) => {
  const markedSubsR = native.getMarkedSubscriptions(server.dbCtxExternal)
  if (markedSubsR) {
    const markedSubs = new Uint8Array(markedSubsR)
    const len = markedSubs.byteLength / 8
    for (let i = 0; i < len; i++) {
      console.log(' -> 2 SUB ID MARKED!', readUint64(markedSubs, i * 8))
    }
  }
}

// make a tool to test subs
await test('subscriptionIds', async (t) => {
  const clientsN = 2
  const { clients, server } = await start(t, clientsN)

  await clients[0].setSchema({
    types: {
      user: {
        derp: 'uint32',
        location: 'string',
        lang: 'string',
      },
    },
  })

  const id = await clients[0].create('user', { derp: 66 })
  const fields = new Uint8Array([0])
  const subId = 66
  const typeId = server.schemaTypesParsed['user'].id
  // ----------------------------
  const headerLen = 14
  let val = new Uint8Array(headerLen + fields.byteLength)
  writeUint64(val, subId, 0)
  writeUint16(val, typeId, 8)
  writeUint32(val, id, 10)
  val.set(fields, headerLen)

  native.addIdSubscription(server.dbCtxExternal, val)

  // for (let i = 1; i < 10e6 - 1; i++) {
  //   writeUint32(val, i, 10)
  //   native.addIdSubscription(server.dbCtxExternal, val)
  // }

  // const close = clients[1]
  //   .query('user', id)
  //   .include('derp')
  //   .subscribe((q) => {
  //     console.log('#0 YO UPDATE id 1 on client 0', q)
  //     cnt++
  //   })

  for (let i = 0; i < 1e6; i++) {
    clients[0].create('user', { derp: i })
  }

  await clients[0].drain()
  console.info('------- UPDATE')
  await clients[1].update('user', id, { derp: 69 })
  await wait(100)
  logSubIds(server)

  // if the same dont!
  console.info('------- UPDATE 2')
  // await clients[1].update('user', id, { derp: 69 })
  await clients[1].update('user', id, { derp: 70 })
  await wait(100)
  logSubIds(server)

  console.info('------- UPDATE 3')
  // await clients[1].update('user', id, { derp: 69 })
  await clients[1].update('user', id, { derp: 71 })
  await wait(100)
  logSubIds(server)

  // native.removeIdSubscription(server.dbCtxExternal, val)

  // console.info('------- 1M updates')
  // let d = Date.now()
  // for (let i = 0; i < 1e6; i++) {
  //   await clients[1].update('user', i + 1, { derp: 72 })
  // }
  // await clients[0].drain()
  // console.log('1M d', Date.now() - d, 'ms')
  logSubIds(server)

  // ----------
  native.removeIdSubscription(server.dbCtxExternal, val)
  console.info('------- UPDATE 4 after remove of sub (no marked)')
  // await clients[1].update('user', id, { derp: 69 })
  await clients[1].update('user', id, { derp: 73 })
  await wait(100)
  logSubIds(server)

  // const close2 = clients[0]
  //   .query('user', id)
  //   .include('derp')
  //   .subscribe((q) => {
  //     console.log('#1 YO UPDATE id 1 on client 1', q)
  //     cnt++
  //   })

  console.info('------- UPDATE 5 after remove of node')
  native.addIdSubscription(server.dbCtxExternal, val)
  // await clients[1].update('user', id, { derp: 69 })
  await clients[1].delete('user', id)
  await wait(100)
  logSubIds(server)

  await wait(100)

  // 1M subs - pretty fast....
  // only thing we need in the client is subs[id]
  // prob make a map there with 2 fields -1 field ids -1 field multi
  const c = clients[1]
  const allUsersRange = await c.query('user').include('derp').get()

  // ----------------------------
  // const id = await clients[0].create('user', { derp: 66 })
  const multiSubId = 99
  // const typeId = server.schemaTypesParsed['user'].id
  // ----------------------------
  // const headerLen = 14
  const val2 = new Uint8Array(10 + 9 + fields.byteLength)
  writeUint32(val2, multiSubId, 0)
  writeUint16(val2, typeId, 8)

  // const fields = new Uint8Array([0])
  // val.set(fields, headerLen)

  console.log('\n=============MULTI TIME')
  const q = c.query('user').include('derp').range(0, 10)
  // .filter('derp', '>', 10)

  const x = await q.get()
  // update range will be a fn

  val2[10] = TYPE_INDEX_MAP.id

  const n = x.toObject()

  console.log('id:', n[0], n[n.length - 1])

  writeUint32(val2, n[0].id, 11)
  writeUint32(val2, n[n.length - 1].id, 15)
  // const fields = new Uint8Array([0])
  val2.set(fields, 19)

  native.addMultiSubscription(server.dbCtxExternal, val2)

  console.info('------- UPDATE FOR MULTI after remove of sub (no marked)')
  // await clients[1].update('user', id, { derp: 69 })
  await clients[1].update('user', 3, { derp: 72 })

  logSubIds(server)

  console.log('derp?')
  logSubIds(server)

  await clients[1].update('user', 3, { derp: 72 })
  logSubIds(server)

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
