import { BasedDb } from '../src/index.js'
import test from './shared/test.js'
import { deepEqual } from './shared/assert.js'

await test('includeChecksum', async (t) => {
  const db = new BasedDb({
    path: t.tmp,
  })
  await db.start({ clean: true })
  t.after(() => t.backup(db))

  await db.setSchema({
    types: {
      item: {
        props: {
          name: 'string',
          items: {
            items: {
              ref: 'item',
              prop: 'items',
              $edgeName: 'string',
            },
          },
        },
      },
    },
  })

  const id1 = await db.create('item', {
    name: 'a',
  })

  deepEqual(await db.query('item').include('name.checksum', 'name').get(), [
    {
      id: 1,
      name: { checksum: 272928132300800, value: 'a' },
    },
  ])

  await db.create('item', {})

  deepEqual(await db.query('item').include('name.checksum', 'name').get(), [
    {
      id: 1,
      name: { checksum: 272928132300800, value: 'a' },
    },
    {
      id: 2,
      name: { checksum: 0, value: '' },
    },
  ])

  deepEqual(await db.query('item').include('name.checksum').get(), [
    {
      id: 1,
      name: { checksum: 272928132300800 },
    },
    {
      id: 2,
      name: { checksum: 0 },
    },
  ])

  db.update('item', 1, {
    items: [
      {
        id: 2,
        $edgeName: 'a',
      },
    ],
  })

  const x = await db.query('item').include('items.$edgeName.checksum').get()

  x.debug()

  x.inspect(20, true)
})
