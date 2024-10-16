import { BasedDb } from '../src/index.js'
import test from './shared/test.js'
import { deepEqual } from './shared/assert.js'

await test('number', async (t) => {
  const db = new BasedDb({
    path: t.tmp,
  })

  await db.start({ clean: true })

  t.after(() => {
    return db.destroy()
  })

  db.putSchema({
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
    // {
    //   number: 1,
    //   int8: 1,
    //   uint8: 1,
    //   int16: 1,
    //   uint16: 1,
    //   int32: 1,
    //   uint32: 1,
    // },
    // {
    //   number: 1.1,
    //   int8: 127,
    //   uint8: 255,
    //   int16: 32_767,
    //   uint16: 65_535,
    //   int32: 2_147_483_647,
    //   uint32: 4_294_967_295,
    // },
    // {
    //   number: -1.1,
    //   int8: -128,
    //   uint8: 0,
    //   int16: -32_768,
    //   uint16: 0,
    //   int32: -2_147_483_648,
    //   uint32: 0,
    // },
  ]

  for (const payload of payloads) {
    db.create('user', payload)
  }

  db.drain() // will become async

  deepEqual(
    db.query('user').get().toObject(),
    payloads.map((payload, index) => {
      return {
        id: index + 1,
        ...payload,
      }
    }),
  )
})
