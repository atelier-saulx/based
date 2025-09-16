import { wait, writeUint16, writeUint32, writeUint64 } from '@based/utils'
import { DbClient } from '../../src/client/index.js'
import { DbServer } from '../../src/server/index.js'
import test from '../shared/test.js'
import { getDefaultHooks } from '../../src/hooks.js'
import native from '../../src/native.js'
import { clientWorker } from '../shared/startWorker.js'
import { BasedDb } from '../../src/index.js'
import { sentence } from '../shared/examples.js'

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

await test('subscription perf', async (t) => {
  const db = new BasedDb({
    path: t.tmp,
    // maxModifySize: 100e6,
  })
  await db.start({ clean: true })
  t.after(() => t.backup(db))

  await db.setSchema({
    types: {
      user: {
        // derp: 'uint32',
        binary: { type: 'binary', maxBytes: 20 },
        flap: { type: 'string', compression: 'none' },
        // lang: 'string',
      },
    },
  })

  let a = sentence + sentence + sentence + sentence

  const bin = new Uint8Array(20)
  for (let i = 0; i < 10e6; i++) {
    db.create('user', { binary: bin, flap: a })
  }

  const dx = await db.drain()
  console.log('db time 10M sets', dx, (10e6 / dx) * 1e3, 'Creates / Second')
  let x = Date.now()

  const q = db.query('user', 1)
  const y = await q.get()
  console.log(q.buffer, y)

  let d = Date.now()

  const p = []
  let cnt = 0
  for (let i = 0; i < 15; i++) {
    p.push(
      clientWorker(
        t,
        db,
        async (client, { ctx, buffer }, { native, utils }) => {
          const dbCtx = native.externalFromInt(ctx)
          // await client.schemaIsSet()
          // const q = client.query('user', 1)
          // await q.get()
          // console.log(q.buffer, y)
          client.flushTime = 11
          for (let i = 0; i < 10e6; i++) {
            utils.writeUint32(buffer, i + 1, 4)
            native.getQueryBuf(buffer, dbCtx)
          }
        },
        {
          ctx: native.intFromExternal(db.server.dbCtxExternal),
          buffer: q.buffer,
        },
      ),
    )
  }

  await Promise.all(p)
  console.log('multicore', ((15 * 10e6) / (Date.now() - d)) * 1e3, ' / Second')
})
