import { BasedDb } from '../src/index.js'
import test from './shared/test.js'

await test('edges', async (t) => {
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
          email: 'string',
          name: 'string',
          smurp: 'string',
          articles: {
            items: {
              ref: 'article',
              prop: 'contributors',
            },
          },
        },
      },
      country: {
        props: {
          code: { type: 'string', maxBytes: 2 },
          name: 'string',
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
              $friend: {
                ref: 'user',
              },
              $countries: {
                items: {
                  ref: 'country',
                },
              },
              $role: ['writer', 'editor'],
              $rating: 'uint32',
              $lang: 'string',
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

  const nl = db.create('country', {
    name: 'Netherlands',
    code: 'nl',
  })

  db.drain()

  const strudelArticle = db.create('article', {
    name: 'The wonders of Strudel',
    contributors: [
      {
        id: mrSnurp,
        // $role: 'writer',
        // $rating: 99,
        // $email: 'AAA',
        // $lang: 'en',
        $friend: mrYur,
        // $countries: [nl],
      },
      // { id: mrYur, $role: 'editor', $rating: 10, $email: 'BBB', $lang: 'de' },
    ],
  })

  db.drain()

  const x = db
    .query('article')
    // .include('contributors.$role')
    // .include('contributors.$rating')
    // .include('contributors.$email')
    // .include('contributors.$lang')
    .include('contributors.$friend')
    // .include('contributors.$countries')
    .get()

  // console.log(x)

  // for (const f of x) {
  // for (const y of f.contributors) {
  // console.log(y, '$ROLE', y.$role)
  // }
  // }

  // await setTimeout(500)

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

// await test('singleRef', async (t) => {
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
//           country: {
//             ref: 'country',
//             prop: 'person',
//           },
//         },
//       },
//       country: {
//         props: {
//           code: { type: 'string', maxBytes: 2 },
//           person: {
//             ref: 'user',
//             prop: 'country',
//             $role: ['president', 'minion'],
//           },
//         },
//       },
//     },
//   })

//   await db.create('country', {
//     code: 'bl',
//     person: {
//       id: db.create('user', {
//         name: 'Mr snurp',
//       }),
//       $role: 'minion',
//     },
//   })

//   console.info('set success!')

//   const x = db.query('country').include('person.$role').get()

//   x.debug()

//   console.log(x.toObject())

//   // for (const f of x) {
//   //   console.log(f.person)
//   // }
// })
