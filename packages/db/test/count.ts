import { deepEqual } from 'assert'
import { BasedDb } from '../src/index.js'
import test from './shared/test.js'
import { Schema } from '@based/schema'

await test('branchedCount', async (t) => {
  const db = new BasedDb({
    path: t.tmp,
  })
  await db.start({ clean: true })
  t.after(() => db.destroy())

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
          rate: 'uint32',
          int16: 'uint16',
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

  const cipolla = db.create('user', {
    name: 'Carlo Cipolla',
    flap: 80,
  })

  const strudelArticle = db.create('article', {
    name: 'The wonders of Strudel',
    contributors: [mrSnurp, flippie],
    rate: 4,
    int16: 2,
  })

  const stupidity = db.create('article', {
    name: 'Les lois fondamentales de la stupidité humaine',
    contributors: [cipolla],
    rate: 5,
    int16: 3,
  })

  // ------------------------------------------------------------
  // TESTS:
  // ------------------------------------------------------------

  deepEqual(
    await db.query('user').range(0, 1).count().get().toObject(),
    { count: 5 },
    'Count > not constrained by range()',
  )

  deepEqual(
    await db.query('user').include('flap').range(0, 1).count().get().toObject(),
    { count: 5 },
    'Count > include() ignored',
  )

  deepEqual(
    await db.query('article').include('**').count().get().toObject(),
    { count: 2 },
    'Sum > summing when including **',
  )

  deepEqual(
    await db
      .query('user')
      .include('flap')
      .range(0, 1)
      .filter('flap', '>', 20)
      .count()
      .get()
      .toObject(),
    { count: 3 },
    'Count > filtered',
  )

  deepEqual(
    await db
      .query('article')
      .include('contributors')
      .count()
      .sort('rate', 'desc')
      .get()
      .toObject(),
    { count: 2 },
    'Count > sort() must not affect',
  )
  // if pass count({alias: 'users'})
  // {users: 3}

  deepEqual(
    await db.query('user').sum('flap').get().toObject(),
    { sum: 180 },
    'Sum > include() ignored',
  )

  deepEqual(
    await db.query('user').range(0, 1).sum('flap').get().toObject(),
    { sum: 180 },
    'sum > not constrained by range()',
  )

  deepEqual(
    await db
      .query('user')
      .include('flap')
      .range(0, 1)
      .filter('flap', '>', 20)
      .sum('flap')
      .get()
      .toObject(),
    { sum: 150 },
    'Sum > filtered',
  )

  deepEqual(
    await db
      .query('user')
      .include('flap')
      .range(0, 1)
      .filter('flap', '>', 20)
      .sort('flap', 'desc')
      .sum('flap')
      .get()
      .toObject(),
    { sum: 150 },
    'Sum > sort() must not affect',
  )

  deepEqual(
    await db.query('article').sum('rate').sort('rate', 'desc').get().toObject(),
    { sum: 9 },
    'Sum > aggregating references (without including)',
  )

  console.log(
    await db
      .query('article')
      // .include('*') // OK
      // .include('**') // NOT OK
      // .include('name') // OK
      .include('contributors') // OK count, NOT OK in sum
      // .count()
      // .sum('rate') // OK
      .sum('int16') // OK
      .get()
      .toObject(),
  )

  deepEqual(
    await db
      .query('article')
      .include('contributors')
      .sum('rate')
      .get()
      .toObject(),
    { sum: 9 },
    'Sum > summing when including references',
  )

  // deepEqual(
  //   await db.query('article').include('**').sum('rate').get().toObject(),
  //   { sum: 9 },
  //   'Sum > summing when including **',
  // )

  // ---------------------------------------------
  // await db
  //   .query('user')
  //   //lala
  //   // .include('flap')
  //   // .filter('flap', '>', 20)
  //   // .range(0, 1)
  //   .count()
  //   // .sum('flap')
  //   .get()
  //   .inspect(), // NOT OK

  // console.log(
  //   await db
  //     .query('article')
  //     // .include('name')
  //     .include('contributors')
  //     .count()
  //     .get()
  //     .toJSON(),
  // )

  // console.log(
  //   await db.query('article').include('contributors').count().get().inspect(),
  // )

  // Here to experiment in branched queries

  // console.log(
  //   await db
  //     .query('article')
  //     .include(
  //       'name',
  //       (q) =>
  //         q('contributors')
  //           // don't line break
  //           .count(),
  //       // .sort('flap', 'desc'),
  //     )
  //     .get()
  //     .toJSON(),
  // )

  // await db
  //   .query('article')
  //   .include('name', (q) =>
  //     q('contributors')
  //       //lala
  //       .sort('flap'),
  //   )
  //   .get()
  //   .inspect()

  // EXPECTED:
  // [
  //  {"id":1, "name":"The wonders of Strudel", "count": 4}'},
  //  {"id":1, "name":"Les lois fondamentales de la stupitité humaine", "count": 1}'}
  // ]

  // count replace the whole contributors key: q(key)
  // with count({alias: 'contributors'})
  // [{"id":1,"name":"The wonders of Strudel","contributors": 4}'}]

  // console.log(
  //   await db
  //     .query('article')
  //     .include((q) => q('contributors').include('name').count())
  //     .get()
  //     .toJSON(),
  // )
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
