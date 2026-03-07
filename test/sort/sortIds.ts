import test from '../shared/test.js'
import { testDb } from '../shared/index.js'
import { isSorted } from '../shared/assert.js'

await test('ids', async (t) => {
  const bla = [0, 1, 2, 3, 4, 5] as const
  const db = await testDb(t, {
    types: {
      user: {
        props: {
          name: 'string',
          email: 'string',
          age: 'timestamp',
          flap: 'uint32',
          blurf: 'number',
          bla,
          mep: { type: 'string', maxBytes: 10 },
        },
      },
    },
  })

  const res: ReturnType<typeof db.create>[] = []
  for (let i = 0; i < 1e3; i++) {
    res.push(
      db.create('user', {
        age: ~~(Math.random() * 100000),
        name: i + ' Mr Dinkelburry',
        email: 'blap@blap.blap.blap',
        flap: i,
        blurf: Math.random() * 10000,
        bla: bla[~~(Math.random() * bla.length)],
        mep: i + 'X',
      }),
    )
  }

  await db.drain()
  const ids: number[] = await Promise.all(res)
  isSorted(await db.query('user', ids).sort('age').get(), 'age')
  isSorted(await db.query('user', ids).sort('name').get(), 'name')
  isSorted(await db.query('user', ids).sort('flap').get(), 'flap')
  isSorted(await db.query('user', ids).sort('blurf').get(), 'blurf')
  isSorted(await db.query('user', ids).sort('bla').get(), 'bla')
  isSorted(await db.query('user', ids).sort('mep').get(), 'mep')
})

await test('references', async (t) => {
  const db = await testDb(t, {
    types: {
      user: {
        props: {
          flap: { type: 'uint32' },
          name: { type: 'string' },
          articles: {
            items: {
              ref: 'article',
              prop: 'contributors',
            },
          },
        },
      },
      article: {
        props: {
          name: { type: 'string' },
          contributors: {
            items: {
              ref: 'user',
              prop: 'articles',
            },
          },
        },
      },
    },
  })

  const res: ReturnType<typeof db.create>[] = []
  for (let i = 0; i < 1e4; i++) {
    res.push(
      db.create('user', {
        flap: ~~(Math.random() * 100000),
        name: 'Mr Dinkelburry ' + i,
      }),
    )
  }

  const ids: number[] = await Promise.all(res)
  const id = await db.create('article', {
    name: '100k contributors master piece',
    contributors: ids,
  })

  isSorted(
    (await db
      .query('article', id)
      .include((s) => s('contributors').sort('flap'))
      .get())!.contributors,
    'flap',
  )
})
