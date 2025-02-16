import { BasedDb } from '../src/index.js'
import { crc32c } from '@based/crc32c'
import test from './shared/test.js'
import { equal } from './shared/assert.js'
import { crc32 as nativeCrc32 } from '../src/index.js'
import { setTimeout as setTimeoutAsync } from 'timers/promises'

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
      transactionN: {
        props: {
          myNativeMadeHash: 'number',
        },
      },
    },
  })

  const transaction = await db.create('transaction', {
    myHash: crc32c(Buffer.from('oid123')),
  })

  const transactionN = await db.create('transactionN', {
    myNativeMadeHash: nativeCrc32(Buffer.from('oid123')),
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

  equal(
    await db
      .query('transactionN')
      .include('id', 'myNativeMadeHash')
      .get()
      .toObject(),
    [
      {
        id: 1,
        myNativeMadeHash: 2628032717,
      },
    ],
  )

  let timer = setTimeout(() => {
    timer = null
  }, 5e3)

  console.time('1E7 CRC32c TS')

  let lastId = 0
  let m: number[] = []

  // while (timer) {
  for (let i = 0; i < 1e7; i++) {
    lastId = db.create('transaction', {
      myHash: crc32c(Buffer.from(`oid${i}`)),
    }).tmpId
    if (i % 2) {
      m.push(lastId)
    }
  }
  // }

  db.update('transaction', transaction, {
    myHash: m,
  })

  await db.drain()

  clearTimeout(timer)

  console.timeEnd('End CRC32c TS')

  console.time('1E7 CRC32c Native')

  // while (timer) {
  lastId = 0
  m = []
  for (let i = 0; i < 1e7; i++) {
    lastId = db.create('transactionN', {
      myNativeMadeHash: nativeCrc32(Buffer.from(`oid${i}`)),
    }).tmpId
    if (i % 2) {
      m.push(lastId)
    }
  }
  // }

  db.update('transactionN', transactionN, {
    myNativeMadeHash: m,
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

  equal(
    await db
      .query('transactionN')
      .include('id', 'myNativeMadeHash')
      .range(813, 2)
      .get()
      .toObject(),
    [
      {
        id: 814,
        myNativeMadeHash: 3342344172,
      },
      {
        id: 815,
        myNativeMadeHash: 894672111,
      },
    ],
  )
  clearTimeout(timer)

  console.timeEnd('End CRC32c Native')
})
