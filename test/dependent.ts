import { deepEqual, equal } from './shared/assert.js'
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

await test('del children', async (t) => {
  const db = new BasedDb({
    path: t.tmp,
  })

  await db.start({ clean: true })
  t.after(() => t.backup(db))

  const client = await db.setSchema({
    types: {
      parent: {
        children: { type: 'references', items: { ref: 'child', prop: 'parent' } }
      },
      child: {
        parent: { type: 'reference', ref: 'parent', prop: 'children', dependent: true },
      },
    }
  })

  for (let n = 1; n <= 5; n++) {
    const head = client.create('parent', {})
    const children: ReturnType<typeof client.create>[] = []

    for (let i = 0; i < n; i++) {
      children.push(client.create('child', { parent: head }))
    }
    deepEqual(await client.query('parent', head).include('**').get(), {
      id: await head,
      children: (await Promise.all(children)).map((id: number) => ({id})),
    })

    for (const child of children) {
      client.delete('child', child)
    }
    await client.drain()
    deepEqual(await client.query('parent', head).include('**').get(), {
      id: await head,
      children: [],
    })

    for (let i = 0; i < n; i++) {
      children.push(client.create('child', { parent: head }))
    }
    await client.delete('parent', head)
    deepEqual(await client.query('parent').get(), [])
    deepEqual(await client.query('child').get(), [])
  }
})
