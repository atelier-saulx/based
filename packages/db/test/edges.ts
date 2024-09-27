import { BasedDb } from '../src/index.js'
import test from './shared/test.js'
import { deepEqual } from './shared/assert.js'

await test('simple', async (t) => {
  const db = new BasedDb({
    path: t.tmp,
  })

  t.after(() => {
    return db.destroy()
  })

  await db.start({ clean: true })

  db.putSchema({
    types: {
      user: {
        props: {
          name: 'string',
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
          name: 'string',
          contributors: {
            type: 'references',
            items: {
              ref: 'user',
              prop: 'articles',
              $role: ['writer', 'editor'],
              $rating: 'uint32',
              $lang: { type: 'string', maxBytes: 2 },
              $email: 'string',
            },
          },
        },
      },
    },
  })

  const mrSnurp = db.create('user', {
    name: 'Mr snurp',
  })

  const mrYur = db.create('user', {
    name: 'Mr Yur',
  })

  db.drain()

  const strudelArticle = db.create('article', {
    name: 'The wonders of Strudel',
    contributors: [
      { id: mrSnurp, $role: 'writer', $rating: 99, $email: 'AAA', $lang: 'en' },
      // { id: mrYur, $role: 'editor', $rating: 10, $email: 'BBB', $lang: 'de' },
    ],
  })

  db.drain()

  const x = db
    .query('article')
    .include('contributors.$role')
    .include('contributors.$rating')
    .include('contributors.$email')
    .include('contributors.$lang')
    .get()

  x.debug()

  for (const f of x) {
    for (const y of f.contributors) {
      console.log(y, '$ROLE', y.$role)
    }
  }

  // console.log(
  //   db
  //     .query('article')
  //     .include('contributors.$role')
  //     .include('contributors.$rating')
  //     .get(),
  // )

  // console.info(db.query('article').include('contributors.$role').get())

  // deepEqual(db.query('user').include('articles.name').get().toObject(), [
  //   {
  //     id: 1,
  //     articles: [
  //       { id: 1, name: 'The wonders of Strudel' },
  //       { id: 2, name: 'Apple Pie is a Lie' },
  //     ],
  //   },
  //   { id: 2, articles: [{ id: 2, name: 'Apple Pie is a Lie' }] },
  // ])
})

// await test('reference', async (t) => {
//   const db = new BasedDb({
//     path: t.tmp,
//   })

//   t.after(() => {
//     return db.destroy()
//   })

//   await db.start({ clean: true })

//   db.putSchema({
//     types: {
//       user: {
//         props: {
//           name: 'string',
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
//           name: 'string',
//           contributors: {
//             type: 'references',
//             items: {
//               ref: 'user',
//               prop: 'articles',
//               $role: ['writer', 'editor'],
//               $rating: 'uint32',
//             },
//           },
//         },
//       },
//     },
//   })

//   const mrSnurp = db.create('user', {
//     name: 'Mr snurp',
//   })

//   const mrYur = db.create('user', {
//     name: 'Mr Yur',
//   })

//   db.drain()

//   const strudelArticle = db.create('article', {
//     name: 'The wonders of Strudel',
//     contributors: [
//       { id: mrSnurp, $role: 'writer', $rating: 99 },
//       { id: mrYur, $role: 'editor', $rating: 10 },
//     ],
//   })

//   db.drain()

//   const x = db
//     .query('article')
//     .include('contributors.$role')
//     .include('contributors.$rating')
//     .get()

//   console.dir(x.toObject(), { depth: 10 })

//   x.debug()

//   for (const f of x) {
//     for (const y of f.contributors) {
//       console.log(y, '$ROLE', y.$role)
//     }
//   }

//   // console.log(
//   //   db
//   //     .query('article')
//   //     .include('contributors.$role')
//   //     .include('contributors.$rating')
//   //     .get(),
//   // )

//   // console.info(db.query('article').include('contributors.$role').get())

//   // deepEqual(db.query('user').include('articles.name').get().toObject(), [
//   //   {
//   //     id: 1,
//   //     articles: [
//   //       { id: 1, name: 'The wonders of Strudel' },
//   //       { id: 2, name: 'Apple Pie is a Lie' },
//   //     ],
//   //   },
//   //   { id: 2, articles: [{ id: 2, name: 'Apple Pie is a Lie' }] },
//   // ])
// })
