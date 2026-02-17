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

  const client = await db.setSchema(schema)

  const createShowTree = async () => {
    const showId = await client.create('show', {})
    const editionId = await client.create('edition', {
      show: showId,
    })
    const sequenceId = await client.create('sequence', {
      edition: editionId,
    })
    const pageId = await client.create('page', {
      sequence: sequenceId,
    })
    await client.create('item', {
      page: pageId,
    })

    await client.drain()

    for (const type in schema.types) {
      const len = (await client.query(type).get()).length
      equal(len, 1)
    }
    return showId
  }

  const showId = await createShowTree()
  await client.delete('show', showId)
  await client.drain()
  for (const type in schema.types) {
    equal((await client.query(type).get()).length, 0)
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
        children: {
          type: 'references',
          items: { ref: 'child', prop: 'parent' },
        },
      },
      child: {
        parent: {
          type: 'reference',
          ref: 'parent',
          prop: 'children',
          dependent: true,
        },
      },
    },
  })

  for (let n = 1; n <= 5; n++) {
    const head = client.create('parent', {})
    const children: ReturnType<typeof client.create>[] = []

    for (let i = 0; i < n; i++) {
      children.push(client.create('child', { parent: head }))
    }
    deepEqual(await client.query('parent', head).include('**').get(), {
      id: await head,
      children: (await Promise.all(children)).map((id: number) => ({ id })),
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

await test('circle of friends', async (t) => {
  const db = new BasedDb({
    path: t.tmp,
  })

  await db.start({ clean: true })
  t.after(() => t.backup(db))

  const client = await db.setSchema({
    types: {
      human: {
        name: { type: 'string', maxBytes: 8 },
        //friends: { type: 'references', items: { ref: 'human', prop: 'friends' } },
        friends: {
          type: 'references',
          items: { ref: 'human', prop: 'friends', dependent: true },
        },
      },
    },
  })

  const h1 = client.create('human', { name: 'joe' })
  const h2 = client.create('human', { name: 'john' })
  const h3 = client.create('human', { name: 'jack' })

  client.update('human', h2, {
    friends: [h1, h3],
  })
  client.update('human', h3, {
    friends: [h2, h1],
  })
  //client.update('human', h3, {
  //  friends: { add: [h2, h1] },
  //})

  deepEqual(await client.query('human').include('**').get(), [
    {
      id: 1,
      friends: [
        {
          id: 2,
          name: 'john',
        },
        {
          id: 3,
          name: 'jack',
        },
      ],
    },
    {
      id: 2,
      friends: [
        {
          id: 1,
          name: 'joe',
        },
        {
          id: 3,
          name: 'jack',
        },
      ],
    },
    {
      id: 3,
      friends: [
        {
          id: 2,
          name: 'john',
        },
        {
          id: 1,
          name: 'joe',
        },
      ],
    },
  ])

  client.delete('human', 1)
  deepEqual(await client.query('human').include('**').get(), [
    {
      id: 2,
      friends: [
        {
          id: 3,
          name: 'jack',
        },
      ],
    },
    {
      id: 3,
      friends: [
        {
          id: 2,
          name: 'john',
        },
      ],
    },
  ])

  client.delete('human', 2)
  deepEqual(await client.query('human').include('**').get(), [])
})
