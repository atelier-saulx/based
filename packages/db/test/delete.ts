import { BasedDb } from '../src/index.js'
import test from './shared/test.js'
import { deepEqual } from './shared/assert.js'

await test('delete', async (t) => {
  const db = new BasedDb({
    path: t.tmp,
  })
  await db.start({ clean: true })
  t.after(() => t.backup(db))

  await db.setSchema({
    types: {
      nurp: {
        props: {
          email: { type: 'string' },
        },
      },
      user: {
        props: {
          name: { type: 'string' },
          age: { type: 'uint32' },
          email: { type: 'string' },
        },
      },
    },
  })

  const simple = db.create('user', {
    name: 'mr snurp',
    age: 99,
    email: 'snurp@snurp.snurp',
  })

  await db.drain()
  db.delete('user', simple)
  await db.drain()

  deepEqual((await db.query('user').get()).toObject(), [])

  const nurp = db.create('nurp', {})
  await db.drain()

  deepEqual((await db.query('nurp').include('email').get()).toObject(), [
    {
      email: '',
      id: 1,
    },
  ])

  db.delete('nurp', nurp)
  await db.drain()

  deepEqual((await db.query('user').include('email').get()).toObject(), [])

  const nurp2 = db.create('nurp', { email: 'flippie' })
  await db.drain()

  db.update('nurp', nurp2, {
    email: null,
  })
  await db.drain()

  deepEqual((await db.query('nurp').include('email').get()).toObject(), [
    {
      email: '',
      id: 2,
    },
  ])
})

await test('non existing 1', async (t) => {
  const db = new BasedDb({
    path: t.tmp,
  })
  await db.start({ clean: true })
  t.after(() => t.backup(db))

  await db.setSchema({
    types: {
      nurp: {
        props: {
          email: { type: 'string' },
        },
      },
      user: {
        props: {
          name: { type: 'string' },
          age: { type: 'uint32' },
          email: { type: 'string' },
        },
      },
    },
  })

  const simple = db.create('user', {
    name: 'mr snurp',
    age: 99,
    email: 'snurp@snurp.snurp',
  })

  await db.drain()
  db.delete('user', simple)
  await db.drain()

  deepEqual((await db.query('user').get()).toObject(), [])

  const nurp = db.create('nurp', {})
  await db.drain()

  deepEqual((await db.query('nurp').include('email').get()).toObject(), [
    {
      email: '',
      id: 1,
    },
  ])

  // this can be handled in js
  await db.delete('nurp', 213123123)

  await db.delete('user', simple)

  // this has to be ignored in C
  await db.delete('user', simple)
})

await test('non existing 2', async (t) => {
  const db = new BasedDb({
    path: t.tmp,
  })
  await db.start({ clean: true })
  t.after(() => t.backup(db))

  await db.setSchema({
    types: {
      nurp: {
        props: {
          email: { type: 'string' },
        },
      },
      user: {
        props: {
          name: { type: 'string' },
          age: { type: 'uint32' },
          email: { type: 'string' },
        },
      },
    },
  })

  const simple = await db.create('user', {
    name: 'mr snurp',
    age: 99,
    email: 'snurp@snurp.snurp',
  })

  await db.delete('user', simple)

  deepEqual((await db.query('user').get()).toObject(), [])

  const nurp = db.create('nurp', {})

  await db.drain()

  deepEqual((await db.query('nurp').include('email').get()).toObject(), [
    {
      email: '',
      id: 1,
    },
  ])

  // this can be handled in js
  await db.delete('nurp', 213123123)

  await db.delete('user', simple)

  // this has to be ignored in C
  await db.delete('user', simple)
})

await test('save', async (t) => {
  const db = new BasedDb({
    path: t.tmp,
  })
  await db.start({ clean: true })

  t.after(() => t.backup(db))

  await db.setSchema({
    types: {
      user: {
        props: {
          name: { type: 'string' },
          age: { type: 'uint32' },
          email: { type: 'string' },
        },
      },
    },
  })

  const first = db.create('user', {
    name: 'mr snurp',
    age: 99,
    email: 'snurp@snurp.snurp',
  })
  db.create('user', {
    name: 'mr slurp',
    age: 99,
    email: 'slurp@snurp.snurp',
  })

  await db.drain()
  await db.save()

  db.delete('user', first)

  await db.drain()
  await db.save()

  const db2 = new BasedDb({
    path: t.tmp,
  })

  await db2.start()

  t.after(() => db2.destroy(), true)

  deepEqual(await db2.query('user').include('id').get().toObject(), [{ id: 2 }])
  deepEqual(await db.query('user').include('id').get().toObject(), [{ id: 2 }])
})

await test('delete performance', async (t) => {
  const db = new BasedDb({
    path: t.tmp,
  })
  await db.start({ clean: true })
  t.after(() => t.backup(db))

  await db.setSchema({
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
  const amount = 1e6
  const users = []

  console.time('create 1M users')
  for (let i = 0; i < amount; i++) {
    users.push(db.create('user', { name: `user_${i}`, flap: i }))
  }
  await db.drain()
  console.timeEnd('create 1M users')

  console.time('delete 1M users')
  for (const user of users) {
    db.delete('user', user)
  }
  await db.drain()
  console.timeEnd('delete 1M users')

  deepEqual((await db.query('user').get()).toObject(), [])

  const amountArticles = 1e6
  const articles = []

  console.time('create 1M articles')
  for (let i = 0; i < amountArticles; i++) {
    articles.push(db.create('article', { name: `article_${i}` }))
  }
  await db.drain()
  console.timeEnd('create 1M articles')

  console.time('delete 1M articles')
  for (const article of articles) {
    db.delete('article', article)
  }
  await db.drain()
  console.timeEnd('delete 1M articles')

  deepEqual((await db.query('article').get()).toObject(), [])

  const articles2 = []

  console.time('create 1M articles - drain interleaved at 10k')
  for (let i = 0; i < amountArticles; i++) {
    articles2.push(db.create('article', { name: `article_${i}` }))
    if (i % 1e5 === 0) {
      await db.drain()
    }
  }
  await db.drain()
  console.timeEnd('create 1M articles - drain interleaved at 10k')

  console.log(
    'if you interleave drain in each batch of 10K deletes you come up if +2min',
    'this test was commented/skipped to not pollute the others',
  )
  // console.time('delete 1M articles - drain interleaved at 10k')
  // for (const article of articles2) {
  //   db.delete('article', article)
  //   if (articles.indexOf(article) % 1e5 === 0) {
  //     await db.drain()
  //   }
  // }
  // await db.drain()
  // console.timeEnd('delete 1M articles - drain interleaved at 10k')

  console.time('delete 1M articles - again')
  for (const article of articles2) {
    db.delete('article', article)
  }
  await db.drain()
  console.timeEnd('delete 1M articles - again')
  deepEqual((await db.query('article').get()).toObject(), [])
})
