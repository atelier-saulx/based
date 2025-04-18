import { BasedDb } from '../src/index.js'
import test from './shared/test.js'
import { deepEqual, equal } from './shared/assert.js'
import { italy } from './shared/examples.js'

const ENCODER = new TextEncoder()

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

  deepEqual((await db.query('user').get()).toObject(), [
    {
      id: 1,
      file: new Uint8Array(new Uint32Array([1, 2, 3, 4]).buffer),
    },
  ])

  const id = await db.create('user', {
    file: new Uint8Array([1, 2, 3, 4]),
  })

  deepEqual((await db.query('user', id).get()).toObject(), {
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
