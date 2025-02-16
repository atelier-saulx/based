import { BasedDb } from '../src/index.js'
import { crc32c } from '@based/crc32c'
import test from './shared/test.js'
import { equal } from './shared/assert.js'

// TODO test should be the same number as the native build in one
await test('simple', async (t) => {
  const db = new BasedDb({
    path: t.tmp,
  })

  await db.start({ clean: true })

  t.after(() => {
    return db.destroy()
  })

  await db.putSchema({
    types: {
      transaction: {
        props: {
          myHash: 'number',
        },
      },
    },
  })

  const transaction = await db.create('transaction', {
    myHash: crc32c(Buffer.from('oid123')),
  })

  equal(
    await db.query('transaction').include('id', 'myHash').get().toObject(),
    [
      {
        id: 1,
        myHash: 2628032717,
      },
    ],
  )

  let lastId = 0
  const m: number[] = []
  for (let i = 0; i < 1e7; i++) {
    lastId = db.create('transaction', {
      myHash: crc32c(Buffer.from(`oid${i}`)),
    }).tmpId
    if (i % 2) {
      m.push(lastId)
    }
  }

  db.update('transaction', transaction, {
    myHash: m,
  })

  await db.drain()

  equal(
    await db
      .query('transaction')
      .include('id', 'myHash')
      .range(813, 2)
      .get()
      .toObject(),
    [
      {
        id: 814,
        myHash: 3342344172,
      },
      {
        id: 815,
        myHash: 894672111,
      },
    ],
  )
})
