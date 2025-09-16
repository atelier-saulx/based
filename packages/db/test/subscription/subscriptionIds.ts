import { wait, writeUint16, writeUint32, writeUint64 } from '@based/utils'
import { DbClient } from '../../src/client/index.js'
import { DbServer } from '../../src/server/index.js'
import test from '../shared/test.js'
import { getDefaultHooks } from '../../src/hooks.js'
import native from '../../src/native.js'
import { clientWorker } from '../shared/startWorker.js'
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

  let cnt = 0
  const id = await clients[0].create('user', { derp: 66 })
  const fields = new Uint8Array([1, 0])
  const subId = 66
  const typeId = server.schemaTypesParsed['user'].id
  // ----------------------------
  const headerLen = 14
  const val = new Uint8Array(headerLen + fields.byteLength)

  //     server.schemaTypesParsed['user'].id,

  writeUint64(val, subId, 0)
  writeUint16(val, typeId, 8)
  writeUint16(val, id, 10)
  val.set(fields, headerLen)

  console.log('flap', server.schemaTypesParsed['user'].id)
  native.addIdSubscription(server.dbCtxExternal, val)

  const close = clients[1]
    .query('user', id)
    .include('derp')
    .subscribe((q) => {
      console.log('#0 YO UPDATE id 1 on client 0', q)
      cnt++
    })

  for (let i = 0; i < 1e6; i++) {
    clients[0].create('user', { derp: i })
  }
  console.log(await clients[0].drain())

  await clients[1].update('user', id, { derp: 69 })

  const close2 = clients[0]
    .query('user', id)
    .include('derp')
    .subscribe((q) => {
      console.log('#1 YO UPDATE id 1 on client 1', q)
      cnt++
    })
  await wait(1e3)

  await clients[0].create('user', { derp: 99 })

  close()
  close2()
})

await test('subscription perf', async (t) => {
  const db = new BasedDb({
    path: t.tmp,
  })
  await db.start({ clean: true })
  t.after(() => t.backup(db))

  await db.setSchema({
    types: {
      user: {
        // derp: 'uint32',
        binary: { type: 'binary', maxBytes: 20 },
        // lang: 'string',
      },
    },
  })

  const bin = new Uint8Array(20)
  for (let i = 0; i < 1e6; i++) {
    db.create('user', { binary: bin })
  }

  console.log(await db.drain())
  let x = Date.now()

  const q = db.query('user', 1)
  const y = await q.get()
  console.log(q.buffer, y)

  let d = Date.now()

  const p = []
  let cnt = 0
  for (let i = 0; i < 10; i++) {
    p.push(
      clientWorker(
        t,
        db,
        async (client, { ctx }, { native, utils }) => {
          const dbCtx = native.externalFromInt(ctx)
          await client.schemaIsSet()
          const q = client.query('user', 1)
          const y = await q.get()
          console.log(q.buffer, y)
          client.flushTime = 11
          for (let i = 0; i < 1e6; i++) {
            utils.writeUint32(q.buffer, i + 1, 4)
            native.getQueryBuf(q.buffer, dbCtx)
          }
          await client.drain()
        },
        { ctx: native.intFromExternal(db.server.dbCtxExternal) },
      ),
    )
  }

  await Promise.all(p)
  console.log('multicore', Date.now() - d)
})
