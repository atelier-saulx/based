import { ENCODER } from '../src/utils/uint8.js'
import test from './shared/test.js'
import { testDb } from './shared/index.js'
import { deepEqual, equal } from './shared/assert.js'
import { italy } from './shared/examples.js'
import { notEqual } from 'node:assert'
import { checksum as q2checksum } from '../src/db-query/query/index.js'

await test('simple', async (t) => {
  const db = await testDb(t, {
    types: {
      user: {
        props: {
          file: { type: 'binary' },
        },
      },
    },
  })

  db.create('user', {
    file: new Uint8Array(new Uint32Array([1, 2, 3, 4]).buffer),
  })

  await db.drain()

  deepEqual(
    await db.query('user').get(),
    [
      {
        id: 1,
        file: new Uint8Array(new Uint32Array([1, 2, 3, 4]).buffer),
      },
    ],
    'Assert u32',
  )

  const id = await db.create('user', {
    file: new Uint8Array([1, 2, 3, 4]),
  })

  deepEqual(await db.query('user', id).get(), {
    id,
    file: new Uint8Array([1, 2, 3, 4]),
  })

  const italyBytes = ENCODER.encode(italy)
  const id2 = await db.create('user', {
    file: italyBytes,
  })

  equal((await db.query('user', id2).get())?.file.length, italyBytes.byteLength)
})

await test('binary and crc32', async (t) => {
  const db = await testDb(t, {
    types: {
      user: {
        article: {
          type: 'binary',
        },
      },
    },
  })

  const user1 = await db.create('user', {
    article: new Uint8Array([1]),
  })

  const checksum = q2checksum(await db.query('user', user1).get())

  await db.update('user', user1, {
    article: new Uint8Array([2]),
  })

  const checksum2 = q2checksum(await db.query('user', user1).get())

  notEqual(checksum, checksum2, 'Checksum is not the same')
})
