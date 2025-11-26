import { BasedDb } from '../src/index.js'
import test from './shared/test.js'
import { deepEqual, perf } from './shared/assert.js'
import assert from 'node:assert'

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
  const users: any[] = []

  await perf(async () => {
    for (let i = 0; i < amount; i++) {
      users.push(db.create('user', { name: `user_${i}`, flap: i }))
    }
    await db.drain()
  }, 'create 1M users')

  const t0 = await perf(async () => {
    for (const user of users) {
      db.delete('user', user)
    }
    await db.drain()
  }, 'delete 1M users')
  assert(t0 < 400, 'delete 1M users')

  deepEqual((await db.query('user').get()).toObject(), [])

  const amountArticles = 1e6
  const articles: any[] = []

  const t1 = await perf(async () => {
    for (let i = 0; i < amountArticles; i++) {
      articles.push(db.create('article', { name: `article_${i}` }))
    }
    await db.drain()
  }, 'create 1M articles')
  assert(t1 < 1500, 'delete 1M users')

  const t2 = await perf(async () => {
    for (const article of articles) {
      db.delete('article', article)
    }
    await db.drain()
  }, 'delete 1M articles')
  assert(t2 < 400, 'delete 1M users')

  deepEqual((await db.query('article').get()).toObject(), [])

  const articles2: any[] = []

  const t3 = await perf(async () => {
    for (let i = 0; i < amountArticles; i++) {
      articles2.push(db.create('article', { name: `article_${i}` }))
      if (i % 1e5 === 0) {
        await db.drain()
      }
    }
    await db.drain()
  }, 'create 1M articles - drain interleaved at 10k')
  assert(t3 < 1500, 'delete 1M users')

  //console.log(
  //  'if you interleave drain in each batch of 10K deletes you come up if +2min',
  //  'this test was commented/skipped to not pollute the others',
  //)
  // console.time('delete 1M articles - drain interleaved at 10k')
  // for (const article of articles2) {
  //   db.delete('article', article)
  //   if (articles.indexOf(article) % 1e5 === 0) {
  //     await db.drain()
  //   }
  // }
  // await db.drain()
  // console.timeEnd('delete 1M articles - drain interleaved at 10k')

  await perf(async () => {
    for (const article of articles2) {
      db.delete('article', article)
    }
    await db.drain()
  }, 'delete 1M articles - again') //  < 400
  deepEqual((await db.query('article').get()).toObject(), [])
})
