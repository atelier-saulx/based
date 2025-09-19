import {
  readDoubleLE,
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
  const val = new Uint8Array(headerLen + fields.byteLength)
  writeUint64(val, subId, 0)
  writeUint16(val, typeId, 8)
  writeUint32(val, id, 10)
  val.set(fields, headerLen)

  native.addIdSubscription(server.dbCtxExternal, val)

  for (let i = 1; i < 1e6 - 1; i++) {
    writeUint32(val, i, 10)
    native.addIdSubscription(server.dbCtxExternal, val)
  }
  writeUint16(val, id, 10)

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

  console.info('------- 1M updates')
  let d = Date.now()
  for (let i = 0; i < 1e6; i++) {
    await clients[1].update('user', id, { derp: 71 })
  }
  await clients[0].drain()
  console.log('1M d', Date.now() - d, 'ms')
  logSubIds(server)

  // ----------
  native.removeIdSubscription(server.dbCtxExternal, val)
  console.info('------- UPDATE 4 after remove of sub (no marked)')
  // await clients[1].update('user', id, { derp: 69 })
  await clients[1].update('user', id, { derp: 71 })
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

  // close()
  // close2()
})
