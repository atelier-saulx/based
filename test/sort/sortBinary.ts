import test from '../shared/test.js'
import { testDb } from '../shared/index.js'
import { deepEqual } from '../shared/assert.js'

await test('binary sort', async (t) => {
  const db = await testDb(t, {
    types: {
      binary: {
        props: {
          data: { type: 'binary' },
          name: { type: 'string' },
        },
      },
    },
  })

  const buffer1 = new Uint8Array([1, 2, 3])
  const buffer2 = new Uint8Array([1, 2, 4])
  const buffer3 = new Uint8Array([0, 1, 2])

  db.create('binary', {
    data: buffer1,
    name: 'first',
  })

  db.create('binary', {
    data: buffer2,
    name: 'second',
  })

  db.create('binary', {
    data: buffer3,
    name: 'third',
  })

  await db.drain()

  deepEqual(await db.query('binary').include('name', 'data').get(), [
    { id: 1, name: 'first', data: buffer1 },
    { id: 2, name: 'second', data: buffer2 },
    { id: 3, name: 'third', data: buffer3 },
  ])

  deepEqual(
    await db.query('binary').sort('data').include('name', 'data').get(),
    [
      { id: 3, name: 'third', data: buffer3 },
      { id: 1, name: 'first', data: buffer1 },
      { id: 2, name: 'second', data: buffer2 },
    ],
    'sort binary asc',
  )

  deepEqual(
    await db
      .query('binary')
      .sort('data')
      .order('desc')
      .include('name', 'data')
      .get(),
    [
      { id: 2, name: 'second', data: buffer2 },
      { id: 1, name: 'first', data: buffer1 },
      { id: 3, name: 'third', data: buffer3 },
    ],
    'sort binary desc',
  )
})
