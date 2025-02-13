import { BasedDb } from '../src/index.js'
import test from './shared/test.js'
import { deepEqual } from './shared/assert.js'

await test('dependent', async (t) => {
  const db = new BasedDb({
    path: t.tmp,
  })

  await db.start({ clean: true })

  t.after(() => {
    return db.destroy()
  })

  const schema = {
    types: {
      show: {
        name: 'string',
      },
      edition: {
        name: 'string',
        show: {
          ref: 'show',
          prop: 'editions',
          dependent: true,
        },
      },
      sequence: {
        name: 'string',
        edition: {
          ref: 'edition',
          prop: 'sequences',
          dependent: true,
        },
      },
      page: {
        name: 'string',
        sequence: {
          ref: 'sequence',
          prop: 'pages',
          dependent: true,
        },
      },
      item: {
        name: 'string',
        page: {
          ref: 'page',
          prop: 'items',
          dependent: true,
        },
      },
    },
  } as const

  await db.putSchema(schema)

  const showId = await db.create('show', {
    editions: [
      db.create('edition', {
        sequences: [
          db.create('sequence', {
            pages: [db.create('page', { items: [db.create('item')] })],
          }),
        ],
      }),
    ],
  })

  console.dir(
    await db
      .query('show')
      .include('editions.sequences.pages.items')
      .get()
      .toObject(),
    { depth: null },
  )

  db.delete('show', showId)

  await db.drain()

  console.log('-----------------------------')

  console.dir(
    await db
      .query('show')
      .include('editions.sequences.pages.items')
      .get()
      .toObject(),
    { depth: null },
  )

  for (const type in schema.types) {
    console.log(type, await db.query(type).get().toObject())
  }
})
