import { equal } from './shared/assert.ts'
import { BasedDb } from '../src/index.ts'
import test from './shared/test.ts'

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

  const createShowTree = async () => {
    const showId = await db.create('show', {})
    const editionId = await db.create('edition', {
      show: showId,
    })
    const sequenceId = await db.create('sequence', {
      edition: editionId,
    })
    const pageId = await db.create('page', {
      sequence: sequenceId,
    })
    await db.create('item', {
      page: pageId,
    })

    await db.drain()

    for (const type in schema.types) {
      const len = (await db.query(type).get()).length
      equal(len, 1)
    }
    return showId
  }

  const showId = await createShowTree()
  await db.delete('show', showId)
  await db.drain()
  for (const type in schema.types) {
    equal((await db.query(type).get()).length, 0)
  }
  await createShowTree()
})
