import { BasedDb } from '../src/index.js'
import test from './shared/test.js'
import { isSorted } from './shared/assert.js'

await test('ids', async (t) => {
  const db = new BasedDb({
    path: t.tmp,
  })

  await db.start({ clean: true })

  t.after(() => {
    return db.destroy()
  })

  db.putSchema({
    types: {
      user: {
        props: {
          name: 'string',
          email: 'string',
          age: 'timestamp',
          flap: 'uint32',
          blurf: 'number',
          bla: [0, 1, 2, 3, 4, 5],
        },
      },
    },
  })

  const ids: number[] = []
  for (let i = 0; i < 1e5; i++) {
    ids.push(
      db.create('user', {
        age: ~~(Math.random() * 100000),
        name: 'Mr Dinkelburry ' + i,
        email: 'blap@blap.blap.blap',
        flap: i,
        blurf: Math.random() * 10000,
        bla: ~~(Math.random() * 5),
      }).tmpId,
    )
  }

  db.drain()

  isSorted(await db.query('user', ids).sort('age').get(), 'age')

  isSorted(await db.query('user', ids).sort('name').get(), 'name')

  isSorted(await db.query('user', ids).sort('flap').get(), 'flap')

  isSorted(await db.query('user', ids).sort('blurf').get(), 'blurf')

  isSorted(await db.query('user', ids).sort('bla').get(), 'bla')
})

await test('references', async (t) => {
  const db = new BasedDb({
    path: t.tmp,
  })

  await db.start({ clean: true })

  t.after(() => {
    return db.destroy()
  })

  db.putSchema({
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

  const ids: number[] = []
  // above 10k make lmdb?
  for (let i = 0; i < 1e4; i++) {
    ids.push(
      db.create('user', {
        flap: ~~(Math.random() * 100000),
        name: 'Mr Dinkelburry ' + i,
      }).tmpId,
    )
  }

  const id = await db.create('article', {
    name: '100k contributors master piece',
    contributors: ids,
  })

  console.log(
    db
      .query('article', id)
      .include((s) => s('contributors').sort('flap'))
      .get(),
  )

  isSorted(
    (
      await db
        .query('article', id)
        .include((s) => s('contributors').sort('flap'))
        .get()
    ).node().contributors,
    'flap',
  )
})
