import { DbClient } from '../../src/client/index.ts'
import { DbServer } from '../../src/server/index.ts'
import test from '../shared/test.ts'
import { getDefaultHooks } from '../../src/hooks.ts'
import native from '../../src/native.ts'
import { clientWorker } from '../shared/startWorker.ts'
import { BasedDb } from '../../src/index.ts'
import { italy } from '../shared/examples.ts'
import { registerSubscription } from '../../src/client/query/subscription/toByteCode.ts'
import { writeUint32 } from '@based/utils'
import { registerQuery } from '../../src/client/query/registerQuery.ts'

await test('subscription perf', async (t) => {
  const db = new BasedDb({
    path: t.tmp,
  })
  await db.start({ clean: true })
  t.after(() => t.backup(db))

  await db.setSchema({
    types: {
      user: {
        flap: { type: 'string', compression: 'none' },
      },
    },
  })

  let a = italy

  const bin = new Uint8Array(20)
  const amount = 1e4

  for (let i = 0; i < amount; i++) {
    db.create('user', { flap: a })
  }

  const dx = await db.drain()

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
        async (client, { ctx, buffer, amount }, { native, utils }) => {
          const dbCtx = native.externalFromInt(ctx)
          for (let i = 0; i < amount; i++) {
            utils.writeUint32(buffer, i + 1, 4)
            native.getQueryBuf(buffer, dbCtx)
          }
        },
        {
          ctx: native.intFromExternal(db.server.dbCtxExternal),
          buffer: q.buffer,
          amount,
        },
      ),
    )
  }

  await Promise.all(p)
  console.log(
    'multicore',
    ((15 * amount) / (Date.now() - d)) * 1e3,
    ' / Second',
  )
})

await test('native single id perf', async (t) => {
  const db = new BasedDb({
    path: t.tmp,
  })
  await db.start({ clean: true })
  t.after(() => t.backup(db))

  await db.setSchema({
    types: {
      user: {
        x: { type: 'uint32' },
        flap: { type: 'string', compression: 'none' },
      },
    },
  })

  const q = db.query('user', 1).include('flap')
  registerQuery(q)
  registerSubscription(q)

  let d = Date.now()
  for (let i = 1; i < 1e6; i++) {
    db.create('user', { x: i })
  }
  await db.drain()
  console.log(Date.now() - d, 'ms create 1M')

  d = Date.now()
  for (let i = 1; i < 1e6; i++) {
    writeUint32(q.subscriptionBuffer, i, 7)
    native.addIdSubscription(db.server.dbCtxExternal, q.subscriptionBuffer)
  }
  console.log(Date.now() - d, 'ms to add 1M subs')

  d = Date.now()
  for (let i = 1; i < 1e6; i++) {
    db.update('user', i, { x: 1 })
  }
  await db.drain()
  console.log(Date.now() - d, 'ms update 1M')
})
