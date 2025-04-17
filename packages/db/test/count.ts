import { BasedDb } from '../src/index.js'
import test from './shared/test.js'
import { deepEqual } from './shared/assert.js'
import { Schema, parse, mermaid } from '@based/schema'

await test('branchedCount', async (t) => {
  const db = new BasedDb({
    path: t.tmp,
  })

  await db.start({ clean: true })

  t.after(() => {
    db.destroy()
  })

  const schema: Schema = {
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
  }
  await db.setSchema(schema)

  // const parsed = parse(schema).schema
  // console.log(mermaid(parsed))

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

  // await db.drain()

  // await db.query('article', strudelArticle).include('*', '**').get().inspect()

  // console.log(
  //   await db
  //     .query('user')
  //     .include('id')
  //     .range(0, 1e9)
  //     .filter('flap', '>', 20)
  //     .count()
  //     .get()
  //     .toObject(),
  // )

  // EXPECTED:
  // [{count: 2}]
  // include in this case has no effect
  // range should not affect count, but TODO: have to check the if clause

  // if pass count({alias: 'users'})
  // [{users: 2}]

  // console.log(
  //   await db
  //     .query('user')
  //     //lala
  //     // .filter('flap', '>', 20)
  //     // .range(0, 0)
  //     .count()
  //     .get()
  //     .toObject(),
  // )

  console.log(
    await db
      .query('article')
      .include('name', 'contributors')
      .count()
      .get()
      .toJSON(),
  )

  // console.log(
  //   await db.query('article').include('contributors').count().get().inspect(),
  // )

  // Here to experiment in branched queries
  // console.log(
  //   await db
  //     .query('article')
  //     .include('name', (q) => q('contributors').count())
  //     .get()
  //     .toJSON(),
  // )

  // EXPECTED:
  // [{"id":1, "name":"The wonders of Strudel", "count": 4}'}]
  // count replace the whole contributors key: q(key)
  // with count({alias: 'contributors'})
  // [{"id":1,"name":"The wonders of Strudel","contributors": 4}'}]

  console.log(
    await db
      .query('article')
      .include((q) => q('contributors').include('name').count())
      .get()
      .toJSON(),
  )
  // EXPECTED:
  // [
  //   {
  //     id: 1,
  //     contributors: [
  // { id: 1, name: 'Mr snurp', count: 1 },
  // { id: 2, name: 'Flippie', count: 1 },
  // { id: 3, name: 'Derpie', count: 1 },
  // { id: 4, name: 'Dinkel Doink', count: 1 },
  //     ],
  //   }
  // ]

  // await db
  //   .query('article')
  //   .include((q) => q('contributors').count('votes'), 'name')
  //   .get()
  //   .inspect(100)

  // Wish: {id: 1, contributors: [{ name: 'jim', votes: 2 }, { name: 'marco', votes: 5 }]}
})
