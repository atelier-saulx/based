import { BasedDb } from '../../src/index.ts'
import test from '../shared/test.ts'
import { deepEqual, isSorted } from '../shared/assert.ts'

await test('numbers', async (t) => {
  const db = new BasedDb({
    path: t.tmp,
  })
  await db.start({ clean: true })
  t.after(() => t.backup(db))

  const animals = ['pony', 'whale', 'dolphin', 'dog']

  await db.setSchema({
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

  await db.drain()

  await db.update('example', 1, {
    u32: { increment: 100 },
  })

  isSorted(await db.query('example').sort('u32').include('u32').get(), 'u32')
  isSorted(
    await db.query('example').sort('boolean').include('boolean').get(),
    'boolean',
  )
  isSorted(await db.query('example').sort('u8').include('u8').get(), 'u8')
  isSorted(await db.query('example').sort('i8').include('i8').get(), 'i8')
  isSorted(await db.query('example').sort('i16').include('i16').get(), 'i16')
  isSorted(await db.query('example').sort('i32').include('i32').get(), 'i32')
  isSorted(
    await db.query('example').sort('number').include('number').get(),
    'number',
  )
  isSorted(
    await db.query('example').sort('timestamp').include('timestamp').get(),
    'timestamp',
  )

  deepEqual(
    await db
      .query('example')
      .sort('enum')
      .include('enum')
      .get()
      .then((v) => v.toObject().map((v) => v.enum)),
    animalsResult.sort((a, b) => animals.indexOf(a) - animals.indexOf(b)),
  )
  db.delete('example', 1)
  isSorted(await db.query('example').sort('u32').include('u32').get(), 'u32')

  await db
    .query('example')
    .include('enum')
    .get()
    .then((v) => v.toObject().map((v) => v.enum))
})
