import { BasedDb } from '../../src/index.ts'
import test from '../shared/test.ts'
import { deepEqual } from '../shared/assert.ts'

await test('binary sort', async (t) => {
  const db = new BasedDb({
    path: t.tmp,
  })
  await db.start({ clean: true })
  t.after(() => t.backup(db))

  await db.setSchema({
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
    await db.query('binary').sort('data', 'desc').include('name', 'data').get(),
    [
      { id: 2, name: 'second', data: buffer2 },
      { id: 1, name: 'first', data: buffer1 },
      { id: 3, name: 'third', data: buffer3 },
    ],
    'sort binary desc',
  )
})
