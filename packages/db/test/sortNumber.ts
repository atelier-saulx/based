import { BasedDb } from '../src/index.js'
import test from './shared/test.js'
import { deepEqual, isSorted } from './shared/assert.js'

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
          u8: 'uint8', // screws stuff up...
          u16: 'uint16',
          u32: 'uint32',
          boolean: 'boolean',
          number: 'number',
          timestamp: 'timestamp',
          i8: 'int8',
          i16: 'int16',
          i32: 'int32',
        },
      },
    },
  })

  db.server.createSortIndex('example', 'u32')

  const len = 10
  const now = Date.now()
  const animalsResult: string[] = []
  for (let i = 0; i < len; i++) {
    const animal = animals[i % animals.length]
    await db.create('example', {
      u8: i,
      u16: i,
      u32: i,
      enum: animal,
      boolean: i % 2 > 0,
      number: i,
      timestamp: now + i,
      i8: i,
      i16: i,
      i32: i,
    })
    animalsResult.push(animal)
  }

  db.drain()

  await db.update('example', 1, {
    u32: { increment: 100 },
  })

  isSorted(await db.query('example').sort('u32').include('u32').get(), 'u32')

  db.server.createSortIndex('example', 'boolean')
  isSorted(
    await db.query('example').sort('boolean').include('boolean').get(),
    'boolean',
  )

  db.server.createSortIndex('example', 'u8')
  isSorted(await db.query('example').sort('u8').include('u8').get(), 'u8')

  db.server.createSortIndex('example', 'i8')
  isSorted(await db.query('example').sort('i8').include('i8').get(), 'i8')

  db.server.createSortIndex('example', 'i16')
  isSorted(await db.query('example').sort('i16').include('i16').get(), 'i16')

  db.server.createSortIndex('example', 'i32')
  isSorted(await db.query('example').sort('i32').include('i32').get(), 'i32')

  db.server.createSortIndex('example', 'number')
  isSorted(
    await db.query('example').sort('number').include('number').get(),
    'number',
  )

  db.server.createSortIndex('example', 'timestamp')
  isSorted(
    await db.query('example').sort('timestamp').include('timestamp').get(),
    'timestamp',
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
})
