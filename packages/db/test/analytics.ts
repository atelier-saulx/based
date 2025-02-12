import { setTimeout } from 'timers/promises'
import { BasedDb } from '../src/index.js'
import test from './shared/test.js'

await test('analytics', async (t) => {
  const db = new BasedDb({
    path: t.tmp,
  })

  t.after(() => {
    return db.destroy()
  })

  await db.start({ clean: true })

  await db.putSchema({
    types: {
      user: {
        props: {
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
              $rating: 'uint32',
            },
          },
        },
      },
    },
  })

  let users = 10
  let i = 0
  while (users--) {
    await db.create('user', {
      name: 'user ' + ++i,
    })
  }

  let articles = 10
  let j = 0
  while (articles--) {
    const res = await db.create('article', {
      name: 'article ' + ++j,
      contributors: [1],
      // contributors: [
      //   {
      //     id: 1,
      //     $rating: 1,
      //   },
      // ],
    })
  }

  await db.update('article', 1, {
    contributors: [
      {
        id: 1,
        $rating: 1,
      },
    ],
  })

  // await db.update('article', 1, {
  //   contributors: [
  //     {
  //       id: 1,
  //       $rating: 1,
  //     },
  //   ],
  // })

  await db.drain()

  console.log(await db.query('user').get().toObject())

  // await setActivePage(1, 1)
  // console.log('DONE')
  // await setTimeout(1e3)

  // // console.log('--???', await db.query('article').include('contributors').get())

  // const getActiveUsers = (userId) => {
  //   return db
  //     .query('user', userId)
  //     .include('activeUsers:activeClients.$activeUsers.#sum')
  //     .get()
  // }

  // getActiveUsers(11) // { id: 11, activeUsers: 4199 }
})

//   let i = 100
//   while (i--) {
//     db.create('user', {
//       age: ~~(Math.random() * 80) + 10
//     })
//   }

//   await db.drain()

//   // working with averages
//   db.query('user')
//     .avg('age')
//     .get()
//   // { age: 34 }

//   db.query('user')
//     .avg('age', 'avgAge')
//     .get()
//   // { avgAge: 34 }

//   db.query('country')
//     .include('name')
//     .include(select => select('users').avg('age'))
//     .get()
//   // [{ name: 'nl', age: 31 }, { name: 'de', age: 45 }]

//   db.query('country')
//     .include('name')
//     .include(select => select('users').avg('age', 'avgAge'))
//     .get()
//   // [{ name: 'nl', avgAge: 31 }, { name: 'de', avgAge: 45 }]

//   db.query('country')
//     .include('name')
//     .include('users.avg(age)')
//     .get()
//   // [{ name: 'nl', avgAge: 31 }, { name: 'de', avgAge: 45 }]

//   db.query('country')
//     .include('name')
//     .include('users.avg(age)')
//     .sort('users.avg(age)') // sort it!
//     .get()
//   // [{ name: 'nl', avgAge: 31 }, { name: 'de', avgAge: 45 }]

//   db.query('country')
//     .include('name')
//     .include('users.age.avg()')
//     .sort('users.age.avg()') // sort it!
//     .get()

//   db.query('country')
//     .include('name')
//     .include('users.age.#avg')
//     .sort('users.age.#avg') // sort it!
//     .get()
//   // [{ name: 'nl', avgAge: 31 }, { name: 'de', avgAge: 45 }]

//   db.query('country')
//     .include('name')
//     .include(select => select('users').avg('age', 'avgAge'))
//     .sort(select => select('users').avg('age', 'avgAge')) // with sort
//     .get()
//   // [{ name: 'nl', avgAge: 31 }, { name: 'de', avgAge: 45 }]

//   db.query('country')
//     .include('name')
//     .include('users.age.ceil(10)')
//     .sort('users.avg(age)')
//     .get()

//   db.query('country')
//     .include('name')
//     .include('users.age.ceil(10)')
//     .sort('users.avg(age)')
//     .get()

//   // db.query('country')
//   //   .include('name')
//   //   .dedup('users.age')
//   //   .get()

//   // [10, 30, 78]
//   // db

//   //  ['safari']

//   //

// //   article1
// //   article2

// //   sevla: [34, 10]

//   // [12, 34, 56]
//   // [0, 12, 1, 34, 2, 56]

//   const schema: Schema = {
//     types: {
//       article: {

//       },
//       user: {
//         props: {
//           activeUsers: {
//                 query: (query, id) => {
//                 return query('user', ).sort('views', 'desc').range(0, 10),
//             }

//           },
//           articles: {
//             items: {
//               ref: 'article',
//               prop: 'users',
//               $activeUsers: 'uint32'
//             }
//           },
//           submits: {
//             type: 'timeseries',
//             intervalInSeconds: 1,
//             items: {
//               type: 'uint32',
//             }
//           },
//           uniqueViews: {
//             type: 'timeseries',
//             intervalInSeconds: 1,
//             items: {
//               type: 'cardinality',
//             }
//           }
//         }
//       }
//     }
//   }

// //   // article1
// //   db.update('user', 34, {
// //     activeUsers: {
// //       increment: 1
// //     }
// //   })

// //   db.update('user', 34, {
// //     activeUsers: {
// //       decrement: 1
// //     }
// //   })

// //   // article2
// //   db.update('user', 34, {
// //     activeUsers: 10
// //   })

// //   // result
// //   db.query('user').get()
// //   // [{ activeUsers: 32 }]

// //   // db.query('events').filter('ts', '>', 321047320).dedup('ts.round()')

// //   []

// //   'track' { userId } => {
// //     db.update('user', userId, {
// //       activeUsers: {
// //         increment: 1
// //       }
// //     })
// //   }

// //   'untrack' { userId } => {
// //     db.update('user', userId, {
// //       activeUsers: {
// //         decrement: 1
// //       }
// //     })
// //   }

// })
