import { deepEqual } from '../../shared/assert.js'
import { testDb } from '../../shared/index.js'
import test from '../../shared/test.js'

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

await test('modify numbers on edge', async (t) => {
  const db = await testDb(t, {
    types: {
      thing: {
        n: 'number',
      },
      holder: {
        toThing: {
          ref: 'thing',
          prop: 'holders',
          $edgeN: 'number',
          $edgeU8: 'uint8',
          $edgeI8: 'int8',
          $edgeU16: 'uint16',
          $edgeI16: 'int16',
          $edgeU32: 'uint32',
          $edgeI32: 'int32',
        },
      },
    },
  })

  const targetId = await db.create('thing', { n: 1 })

  // 1. Initial values
  const id1 = await db.create('holder', {
    toThing: {
      id: targetId,
      $edgeN: 1.5,
      $edgeU8: 10,
      $edgeI8: -10,
      $edgeU16: 1000,
      $edgeI16: -1000,
      $edgeU32: 100000,
      $edgeI32: -100000,
    },
  })

  // Border values
  const id2 = await db.create('holder', {
    toThing: {
      id: targetId,
      $edgeN: 100.5,
      $edgeU8: 255,
      $edgeI8: 127,
      $edgeU16: 65535,
      $edgeI16: 32767,
      $edgeU32: 4294967295,
      $edgeI32: 2147483647,
    },
  })

  // Min values
  const id3 = await db.create('holder', {
    toThing: {
      id: targetId,
      $edgeN: -100.5,
      $edgeU8: 0,
      $edgeI8: -128,
      $edgeU16: 0,
      $edgeI16: -32768,
      $edgeU32: 0,
      $edgeI32: -2147483648,
    },
  })

  // Helper to get edge props
  const getEdgeProps = async (id: number) => {
    const res = await db
      .query('holder', id)
      .include(
        'toThing.$edgeN',
        'toThing.$edgeU8',
        'toThing.$edgeI8',
        'toThing.$edgeU16',
        'toThing.$edgeI16',
        'toThing.$edgeU32',
        'toThing.$edgeI32',
      )
      .get()
      .toObject()

    if (!res.toThing || Array.isArray(res.toThing)) {
      return {}
    }

    return {
      edgeN: res.toThing.$edgeN,
      edgeU8: res.toThing.$edgeU8,
      edgeI8: res.toThing.$edgeI8,
      edgeU16: res.toThing.$edgeU16,
      edgeI16: res.toThing.$edgeI16,
      edgeU32: res.toThing.$edgeU32,
      edgeI32: res.toThing.$edgeI32,
    }
  }

  deepEqual(await getEdgeProps(id1), {
    edgeN: 1.5,
    edgeU8: 10,
    edgeI8: -10,
    edgeU16: 1000,
    edgeI16: -1000,
    edgeU32: 100000,
    edgeI32: -100000,
  })

  deepEqual(await getEdgeProps(id2), {
    edgeN: 100.5,
    edgeU8: 255,
    edgeI8: 127,
    edgeU16: 65535,
    edgeI16: 32767,
    edgeU32: 4294967295,
    edgeI32: 2147483647,
  })

  deepEqual(await getEdgeProps(id3), {
    edgeN: -100.5,
    edgeU8: 0,
    edgeI8: -128,
    edgeU16: 0,
    edgeI16: -32768,
    edgeU32: 0,
    edgeI32: -2147483648,
  })

  // Update
  await db.update('holder', id1, {
    toThing: {
      id: targetId,
      $edgeN: 2.5,
      $edgeU8: 11,
      $edgeI8: -11,
      $edgeU16: 1001,
      $edgeI16: -1001,
      $edgeU32: 100001,
      $edgeI32: -100001,
    },
  })

  deepEqual(await getEdgeProps(id1), {
    edgeN: 2.5,
    edgeU8: 11,
    edgeI8: -11,
    edgeU16: 1001,
    edgeI16: -1001,
    edgeU32: 100001,
    edgeI32: -100001,
  })

  // Increment
  await db.update('holder', id1, {
    toThing: {
      id: targetId,
      $edgeN: { increment: 2.5 },
      $edgeU8: { increment: 1 },
      $edgeI8: { increment: 1 },
      $edgeU16: { increment: 1 },
      $edgeI16: { increment: 1 },
      $edgeU32: { increment: 1 },
      $edgeI32: { increment: 1 },
    },
  })

  deepEqual(await getEdgeProps(id1), {
    edgeN: 5,
    edgeU8: 12,
    edgeI8: -10,
    edgeU16: 1002,
    edgeI16: -1000,
    edgeU32: 100002,
    edgeI32: -100000,
  })

  // Decrement
  await db.update('holder', id1, {
    toThing: {
      id: targetId,
      $edgeN: { increment: -2.5 },
      $edgeU8: { increment: -1 },
      $edgeI8: { increment: -1 },
      $edgeU16: { increment: -1 },
      $edgeI16: { increment: -1 },
      $edgeU32: { increment: -1 },
      $edgeI32: { increment: -1 },
    },
  })

  deepEqual(await getEdgeProps(id1), {
    edgeN: 2.5,
    edgeU8: 11,
    edgeI8: -11,
    edgeU16: 1001,
    edgeI16: -1001,
    edgeU32: 100001,
    edgeI32: -100001,
  })
})
