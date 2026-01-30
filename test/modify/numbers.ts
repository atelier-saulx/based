import { deepEqual } from '../shared/assert.js'
import { testDb } from '../shared/index.js'
import test from '../shared/test.js'

await test('modify numbers', async (t) => {
  const db = await testDb(t, {
    types: {
      thing: {
        n: 'number',
        u8: 'uint8',
        i8: 'int8',
        u16: 'uint16',
        i16: 'int16',
        u32: 'uint32',
        i32: 'int32',
      },
    },
  })

  const id1 = await db.create('thing', {
    n: 1.5,
    u8: 10,
    i8: -10,
    u16: 1000,
    i16: -1000,
    u32: 100000,
    i32: -100000,
  })

  // Border values
  const id2 = await db.create('thing', {
    n: 100.5,
    u8: 255,
    i8: 127,
    u16: 65535,
    i16: 32767,
    u32: 4294967295,
    i32: 2147483647,
  })

  // Min values (for signed)
  const id3 = await db.create('thing', {
    n: -100.5,
    u8: 0,
    i8: -128,
    u16: 0,
    i16: -32768,
    u32: 0,
    i32: -2147483648,
  })

  deepEqual(await db.query('thing').get(), [
    {
      id: id1,
      n: 1.5,
      u8: 10,
      i8: -10,
      u16: 1000,
      i16: -1000,
      u32: 100000,
      i32: -100000,
    },
    {
      id: id2,
      n: 100.5,
      u8: 255,
      i8: 127,
      u16: 65535,
      i16: 32767,
      u32: 4294967295,
      i32: 2147483647,
    },
    {
      id: id3,
      n: -100.5,
      u8: 0,
      i8: -128,
      u16: 0,
      i16: -32768,
      u32: 0,
      i32: -2147483648,
    },
  ])

  db.update('thing', id1, {
    n: 2.5,
    u8: 11,
    i8: -11,
    u16: 1001,
    i16: -1001,
    u32: 100001,
    i32: -100001,
  })

  deepEqual(await db.query('thing', id1).get(), {
    id: id1,
    n: 2.5,
    u8: 11,
    i8: -11,
    u16: 1001,
    i16: -1001,
    u32: 100001,
    i32: -100001,
  })

  db.update('thing', id1, {
    n: { increment: 2.5 },
    u8: { increment: 1 },
    i8: { increment: 1 },
    u16: { increment: 1 },
    i16: { increment: 1 },
    u32: { increment: 1 },
    i32: { increment: 1 },
  })

  deepEqual(await db.query('thing', id1).get(), {
    id: id1,
    n: 5,
    u8: 12,
    i8: -10,
    u16: 1002,
    i16: -1000,
    u32: 100002,
    i32: -100000,
  })

  db.update('thing', id1, {
    n: { increment: -2.5 },
    u8: { increment: -1 },
    i8: { increment: -1 },
    u16: { increment: -1 },
    i16: { increment: -1 },
    u32: { increment: -1 },
    i32: { increment: -1 },
  })

  deepEqual(await db.query('thing', id1).get(), {
    id: id1,
    n: 2.5,
    u8: 11,
    i8: -11,
    u16: 1001,
    i16: -1001,
    u32: 100001,
    i32: -100001,
  })
})
