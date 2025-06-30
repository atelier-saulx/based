import { deepEqual } from './shared/assert.js'
import { BasedDb } from '../src/index.js'
import test from './shared/test.js'

await test('dependent', async (t) => {
  const db = new BasedDb({
    path: t.tmp,
  })
  await db.start({ clean: true })
  t.after(() => t.backup(db))

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

  await db.setSchema(schema)

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

  db.delete('show', showId)

  await db.drain()

  for (const type in schema.types) {
    deepEqual(await db.query(type).get(), [], `${type} is empty`)
  }
})
