import { BasedDb } from '../src/index.js'
import test from './shared/test.js'
import { deepEqual } from './shared/assert.js'

await test('basic', async (t) => {
  const db = new BasedDb({
    path: t.tmp,
  })
  await db.start({ clean: true })
  t.after(() => t.backup(db))

  await db.setSchema({
    types: {
      user: {
        props: {
          number: 'number',
          int8: 'int8',
          uint8: 'uint8',
          int16: 'int16',
          uint16: 'uint16',
          int32: 'int32',
          uint32: 'uint32',
        },
      },
    },
  })

  const payloads = [
    {
      number: 0,
      int8: 0,
      uint8: 0,
      int16: 0,
      uint16: 0,
      int32: 0,
      uint32: 0,
    },
    {
      number: 1,
      int8: 1,
      uint8: 1,
      int16: 1,
      uint16: 1,
      int32: 1,
      uint32: 1,
    },
    {
      number: 1.1,
      int8: 127,
      uint8: 255,
      int16: 32_767,
      uint16: 65_535,
      int32: 2_147_483_647,
      uint32: 4_294_967_295,
    },
    {
      number: -1.1,
      int8: -128,
      uint8: 0,
      int16: -32_768,
      uint16: 0,
      int32: -2_147_483_648,
      uint32: 0,
    },
  ]

  for (const payload of payloads) {
    db.create('user', payload)
  }

  await db.drain() // will become async
  deepEqual(
    (await db.query('user').get()).toObject(),
    payloads.map((payload, index) => {
      return {
        id: index + 1,
        ...payload,
      }
    }),
  )
  const newThing = await db.create('user', {
    number: {
      increment: 12,
    },
    int8: {
      increment: 12,
    },
    uint8: {
      increment: 12,
    },
    int16: {
      increment: 12,
    },
    uint16: {
      increment: 12,
    },
    int32: {
      increment: 12,
    },
    uint32: {
      increment: 12,
    },
  })

  deepEqual((await db.query('user', newThing).get()).toObject(), {
    id: newThing,
    number: 12,
    int8: 12,
    uint8: 12,
    int16: 12,
    uint16: 12,
    int32: 12,
    uint32: 12,
  })

  await db.update('user', newThing, {
    number: {
      increment: 1,
    },
    int8: {
      increment: 2,
    },
    uint8: {
      increment: 3,
    },
    int16: {
      increment: 4,
    },
    uint16: {
      increment: 5,
    },
    int32: {
      increment: 6,
    },
    uint32: {
      increment: 7,
    },
  })

  deepEqual((await db.query('user', newThing).get()).toObject(), {
    id: newThing,
    number: 13,
    int8: 14,
    uint8: 15,
    int16: 16,
    uint16: 17,
    int32: 18,
    uint32: 19,
  })

  await db.update('user', newThing, {
    uint16: {
      increment: 700,
    },
  })

  deepEqual((await db.query('user', newThing).get()).toObject(), {
    id: newThing,
    number: 13,
    int8: 14,
    uint8: 15,
    int16: 16,
    uint16: 17 + 700,
    int32: 18,
    uint32: 19,
  })

  await db.update('user', newThing, {
    uint16: {
      increment: -333,
    },
  })

  deepEqual((await db.query('user', newThing).get()).toObject(), {
    id: newThing,
    number: 13,
    int8: 14,
    uint8: 15,
    int16: 16,
    uint16: 17 + 700 - 333,
    int32: 18,
    uint32: 19,
  })

  await db.update('user', newThing, {
    uint16: 100,
  })

  deepEqual((await db.query('user', newThing).get()).toObject(), {
    id: newThing,
    number: 13,
    int8: 14,
    uint8: 15,
    int16: 16,
    uint16: 100,
    int32: 18,
    uint32: 19,
  })
})
