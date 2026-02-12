import { BasedDb } from '../src/index.js'
import { ENCODER } from '../src/utils/uint8.js'
import test from './shared/test.js'
import { deepEqual, equal } from './shared/assert.js'
import { italy } from './shared/examples.js'
import { notEqual } from 'node:assert'

await test('simple', async (t) => {
  const db = new BasedDb({
    path: t.tmp,
  })
  await db.start({ clean: true })
  t.after(() => t.backup(db))

  await db.setSchema({
    types: {
      user: {
        props: {
          file: { type: 'binary' },
        },
      },
    },
  })

  db.create('user', {
    file: new Uint32Array([1, 2, 3, 4]),
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

  equal(
    (await db.query('user', id2).get()).toObject().file.length,
    italyBytes.byteLength,
  )
})

await test('binary and crc32', async (t) => {
  const db = new BasedDb({
    path: t.tmp,
  })
  await db.start({ clean: true })
  t.after(() => t.backup(db))

  await db.setSchema({
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

  const checksum = (await db.query('user', user1).get()).checksum

  await db.update('user', user1, {
    article: new Uint8Array([2]),
  })

  const checksum2 = (await db.query('user', user1).get()).checksum

  notEqual(checksum, checksum2, 'Checksum is not the same')
})
