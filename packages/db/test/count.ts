import { BasedDb } from '../src/index.js'
import test from './shared/test.js'
import { deepEqual } from './shared/assert.js'

await test('branchedCount', async (t) => {
  const db = new BasedDb({
    path: t.tmp,
  })

  await db.start({ clean: true })

  t.after(() => {
    return t.backup(db)
  })

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

  const mrSnurp = db.create('user', {
    name: 'Mr snurp',
    flap: 10,
  })

  const flippie = db.create('user', {
    name: 'Flippie',
    flap: 20,
  })

  const derpie = db.create('user', {
    name: 'Derpie',
    flap: 30,
  })

  const dinkelDoink = db.create('user', {
    name: 'Dinkel Doink',
    flap: 40,
  })

  const strudelArticle = db.create('article', {
    name: 'The wonders of Strudel',
    contributors: [mrSnurp, flippie, derpie, dinkelDoink],
  })

  await db.drain()

  // await db.query('article', strudelArticle).include('*', '**').get().inspect()

  console.log(
    await db
      .query('user')
      //lala
      .filter('flap', '>', 20)
      .count()
      .get()
      .toObject(),
  )

  await db.query('user').filter('flap', '>', 20).count().get().inspect()

  // console.log(
  //   await db
  //     .query('article')
  //     .include('name', 'contributors')
  //     .count()
  //     .get()
  //     .toObject(),
  // )

  // await db.query('article').include('contributors').get().inspect()

  // await db
  //   .query('article')
  //   .include((q) => q('contributors'), 'name')
  //   .get()
  //   .inspect(100)

  //  {id: 1, contributors: [{ name: 'jim', votes: 2 }, { name: 'marco', votes: 5 }]}
})
