import { BasedDb } from '../src/db.js'
import test from './shared/test.js'
import { throws, deepEqual } from './shared/assert.js'
import { wait } from '../src/utils/index.js'

await test.skip('dev', async (t) => {
  const db = new BasedDb({
    path: t.tmp,
    maxModifySize: 1e6,
  })

  await db.start({ clean: true })
  t.after(() => db.stop())

  await db.setSchema({
    types: {
      user: {
        props: {
          flap: { type: 'uint32' },
          country: { type: 'string' },
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
    country: 'NL',
    name: 'Mr snurp',
    flap: 10,
  })

  const flippie = db.create('user', {
    country: 'NL',
    name: 'Flippie',
    flap: 20,
  })

  const derpie = db.create('user', {
    country: 'BR',
    name: 'Derpie',
    flap: 30,
  })

  const dinkelDoink = db.create('user', {
    name: 'Dinkel Doink',
    flap: 40,
  })

  const cipolla = db.create('user', {
    country: 'IT',
    name: 'Carlo Cipolla',
    flap: 80,
  })

  const strudelArticle = db.create('article', {
    name: 'The wonders of Strudel',
    contributors: [mrSnurp, flippie, derpie, dinkelDoink],
  })

  const stupidity = db.create('article', {
    name: 'Les lois fondamentales de la stupidité humaine',
    contributors: [cipolla],
  })

  // OK
  await db
    // dont break line
    .query('user')
    .include('**')
    .groupBy('country')
    .sum('name')
    .get()
    .inspect()

  // OK
  // await db
  //   // dont break line
  //   .query('user')
  //   .groupBy('name')
  //   .sum('flap')
  //   .get()

  // TODO: display is tagging "sum" when count with alias
  // TODO: also there os a misplaced comma in inspect
  // await db
  //   .query('article')
  //   .include((q) => q('contributors').count('votes'), 'name')
  //   .get()
  //   .inspect()
})

// await test.skip('kev', async (t) => {
//   const db = new BasedDb({
//     path: t.tmp,
//     maxModifySize: 1e6,
//   })

//   await db.start({ clean: true })
//   t.after(() => db.stop())

//   await db.setSchema({
//     types: {
//       user: {
//         props: {
//           flap: { type: 'uint32' },
//           country: { type: 'string' },
//           myUniqueValuesCount: 'cardinality',
//           name: { type: 'string' },
//           articles: {
//             items: {
//               ref: 'article',
//               prop: 'contributors',
//             },
//           },
//         },
//       },
//       article: {
//         props: {
//           name: { type: 'string' },
//           contributors: {
//             items: {
//               ref: 'user',
//               prop: 'articles',
//             },
//           },
//         },
//       },
//     },
//   })

//   const mrSnurp = db.create('user', {
//     country: 'NL',
//     name: 'Mr snurp',
//     flap: 10,
//     myUniqueValuesCount: ['bla', 'blu'],
//   })

//   const flippie = db.create('user', {
//     country: 'NL',
//     name: 'Flippie',
//     flap: 20,
//     myUniqueValuesCount: 'blo',
//   })

//   const derpie = db.create('user', {
//     country: 'BR',
//     name: 'Derpie',
//     flap: 30,
//     myUniqueValuesCount: 'ble',
//   })

//   const dinkelDoink = db.create('user', {
//     country: 'NL',
//     name: 'Dinkel Doink',
//     flap: 40,
//     myUniqueValuesCount: 'bla',
//   })

//   const cipolla = db.create('user', {
//     country: 'IT',
//     name: 'Carlo Cipolla',
//     flap: 80,
//     myUniqueValuesCount: ['bla', 'ble', 'bli'],
//   })

//   const strudelArticle = db.create('article', {
//     name: 'The wonders of Strudel',
//     contributors: [mrSnurp, flippie, derpie, dinkelDoink],
//   })

//   const stupidity = db.create('article', {
//     name: 'Les lois fondamentales de la stupidité humaine',
//     contributors: [cipolla],
//   })

//   // TODO: display is tagging "sum" when count with alias
//   // TODO: also there os a misplaced comma in inspect
//   // await db
//   //   .query('article')
//   //   .include((q) => q('contributors').count('votes'), 'name')
//   //   .get()
//   //   .inspect()

//   // deepEqual(
//   //   await db
//   //     .query('article')
//   //     .include((q) => q('contributors').sum('flap'), 'name')
//   //     .get()
//   //     .toObject(),
//   //   [
//   //     { id: 1, name: 'The wonders of Strudel', contributors: { flap: 100 } },
//   //     {
//   //       id: 2,
//   //       name: 'Les lois fondamentales de la stupidité humaine',
//   //       contributors: { flap: 80 },
//   //     },
//   //   ],
//   //   'sum, branched query, var len string',
//   // )

//   await db
//     // dont break line
//     .query('user')
//     .groupBy('country')
//     .cardinality('myUniqueValuesCount')
//     .get()
//     .inspect() // OK

//   // TODO: string byteSize > 2

//   // const q = await db
//   //   // dont break line
//   //   .query('users')
//   //   .get()

//   // q.inspect()

//   // await db
//   //   // dont break line
//   //   .query('user')
//   //   .groupBy('name')
//   //   .sum('flap')
//   //   .get()
//   //   .inspect()
// })
