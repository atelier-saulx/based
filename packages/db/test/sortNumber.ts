import { BasedDb } from '../src/index.js'
import test from './shared/test.js'
import { deepEqual } from './shared/assert.js'

await test('numbers', async (t) => {
  const db = new BasedDb({
    path: t.tmp,
  })

  await db.start({ clean: true })

  t.after(() => {
    return db.destroy()
  })

  const animals = ['pony', 'whale', 'dolphin', 'dog']

  db.putSchema({
    types: {
      example: {
        props: {
          enum: animals,
          // u8: { type: 'uint8' }, screws stuff up...
          // u16: { type: 'uint16' },
          u32: { type: 'uint32' },
          boolean: { type: 'boolean' },
        },
      },
    },
  })

  db.server.createSortIndex('example', 'u32')

  const len = 10
  const animalsResult: string[] = []
  for (let i = 0; i < len; i++) {
    const animal = animals[i % animals.length]
    await db.create('example', {
      // u8: i,
      // u16: i,
      u32: i,
      enum: animal,
      boolean: i % 2 > 0,
    })
    animalsResult.push(animal)
  }

  db.drain()

  await db.update('example', 1, {
    u32: { increment: 1e9 },
  })

  deepEqual(
    await db
      .query('example')
      .sort('u32')
      .include('u32')
      .get()
      .then((v) => v.toObject()),
    [
      { id: 2, u32: 1 },
      { id: 3, u32: 2 },
      { id: 4, u32: 3 },
      { id: 5, u32: 4 },
      { id: 6, u32: 5 },
      { id: 7, u32: 6 },
      { id: 8, u32: 7 },
      { id: 9, u32: 8 },
      { id: 10, u32: 9 },
      { id: 1, u32: 1000000000 },
    ],
  )

  db.server.createSortIndex('example', 'enum')

  deepEqual(
    await db
      .query('example')
      .sort('enum')
      .include('enum')
      .get()
      .then((v) => v.toObject().map((v) => v.enum)),
    animalsResult.sort((a, b) => animals.indexOf(a) - animals.indexOf(b)),
  )

  db.server.createSortIndex('example', 'boolean')

  deepEqual(
    await db
      .query('example')
      .sort('boolean')
      .include('boolean')
      .get()
      .then((v) => v.toObject().map((v) => v)),
    [
      { id: 9, boolean: false },
      { id: 7, boolean: false },
      { id: 5, boolean: false },
      { id: 3, boolean: false },
      { id: 1, boolean: false },
      { id: 10, boolean: true },
      { id: 8, boolean: true },
      { id: 6, boolean: true },
      { id: 4, boolean: true },
      { id: 2, boolean: true },
    ],
  )

  // db.server.createSortIndex('example', 'u8')

  // deepEqual(
  //   await db
  //     .query('example')
  //     .sort('u8')
  //     .include('u8')
  //     .get()
  //     .then((v) => v.toObject()),
  //   [
  //     { id: 1, u8: 0 },
  //     { id: 2, u8: 1 },
  //     { id: 3, u8: 2 },
  //     { id: 4, u8: 3 },
  //     { id: 5, u8: 4 },
  //     { id: 6, u8: 5 },
  //     { id: 7, u8: 6 },
  //     { id: 8, u8: 7 },
  //     { id: 9, u8: 8 },
  //     { id: 10, u8: 9 },
  //   ],
  // )

  // db.server.createSortIndex('example', 'u16')

  // deepEqual(
  //   await db
  //     .query('example')
  //     .sort('u16')
  //     .include('u16')
  //     .get()
  //     .then((v) => v.toObject()),
  //   [
  //     { id: 1, u16: 0 },
  //     { id: 2, u16: 1 },
  //     { id: 3, u16: 2 },
  //     { id: 4, u16: 3 },
  //     { id: 5, u16: 4 },
  //     { id: 6, u16: 5 },
  //     { id: 7, u16: 6 },
  //     { id: 8, u16: 7 },
  //     { id: 9, u16: 8 },
  //     { id: 10, u16: 9 },
  //   ],
  // )
})
