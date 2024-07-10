import test from 'ava'
import { wait } from '@saulx/utils'
import { fileURLToPath } from 'url'
import fs from 'node:fs/promises'
import { BasedDb } from '../src/index.js'
import { join, dirname, resolve } from 'path'
import { text } from './examples.js'

import native from '../src/db.js'

const __dirname = dirname(fileURLToPath(import.meta.url).replace('/dist/', '/'))
const relativePath = '../tmp'
const dbFolder = resolve(join(__dirname, relativePath))

// test.serial('set and simple get', async (t) => {
//   try {
//     await fs.rm(dbFolder, { recursive: true })
//   } catch (err) {}
//   await fs.mkdir(dbFolder)

//   const db = new BasedDb({
//     path: dbFolder,
//   })

//   db.updateSchema({
//     types: {
//       simple: {
//         fields: {
//           user: { type: 'reference', allowedType: 'user' },
//           vectorClock: { type: 'integer' },
//           location: {
//             type: 'object',
//             properties: {
//               long: { type: 'number' },
//               lat: { type: 'number' },
//             },
//           },
//         },
//       },
//       vote: {
//         fields: {
//           refs: { type: 'references' },
//           user: { type: 'reference', allowedType: 'user' },
//           vectorClock: { type: 'integer' },
//           location: {
//             type: 'object',
//             properties: {
//               long: { type: 'timestamp' },
//               lat: { type: 'timestamp' },
//             },
//           },
//         },
//       },
//       complex: {
//         fields: {
//           flap: {
//             type: 'integer',
//           },
//           value: {
//             type: 'integer',
//           },
//           nip: {
//             type: 'string',
//           },
//           mep: {
//             type: 'number',
//           },
//           created: {
//             type: 'timestamp',
//           },
//           updated: {
//             type: 'timestamp',
//           },
//           gerp: {
//             type: 'reference',
//             allowedType: 'vote',
//           },
//           snurp: {
//             type: 'object',
//             properties: {
//               refTime: { type: 'references', allowedType: 'vote' },
//               ups: { type: 'references', allowedType: 'vote' },
//               derp: { type: 'integer' },
//               bla: { type: 'string' },
//               hup: {
//                 type: 'object',
//                 properties: {
//                   start: {
//                     type: 'timestamp',
//                   },
//                   x: { type: 'integer' },
//                   isDope: { type: 'boolean' },
//                 },
//               },
//             },
//           },
//         },
//       },
//     },
//   })

//   // const id2 = db.create('vote', {
//   //   user: 15,
//   //   vectorClock: 12,
//   //   location: {
//   //     long: 1,
//   //     lat: 1,
//   //   },
//   // })

//   var str = 'flap'
//   for (let i = 0; i < 1e3; i++) {
//     str += 'bla ' + i
//   }

//   // console.info(str)
//   console.log('---------------------------')

//   var d = Date.now()
//   // for (let i = 0; i < 1e9; i++) {
//   //   db.create('complex', {
//   //     flap: 1,
//   //     // nip: 'flap flap flap flap flap flap flap flap flap flap flap flpa flpa flpal flpa',
//   //     snurp: {
//   //       derp: i,
//   //     },
//   //   })
//   // }

//   // await wait(0)
//   // console.log('old', Date.now() - d, 'ms')

//   await wait(100)
//   console.log('---------------------------')
//   d = Date.now()
//   for (let i = 0; i < 10e6; i++) {
//     db.create('complex', {
//       flap: 1,
//       snurp: {
//         derp: i + 1,
//         hup: { start: 1000 },
//         bla: 'BLA!',
//       },
//       nip: 'flap flap flap flap flap flap flap flap flap flap flap flpa flpa flpal flpa',
//     })
//   }

//   await wait(0)
//   const bla = db.get('complex', 1)
//   console.log(bla)

//   console.log('new', Date.now() - d, 'ms')

//   // const id = db.create('complex', {
//   //   value: 666,
//   //   nip: 'FRANKO!',
//   //   gerp: 999,
//   //   snurp: { bla: 'yuzi', ups: [1, 2, 3, 4, 5] },
//   // })
//   // console.log('---------------------------')

//   // console.info('??', id)

//   await wait(1e3)

//   // const doesNotExist = db.get('simple', 0)

//   // console.info('snurp', doesNotExist)

//   // t.deepEqual(db.get('complex', id), {
//   //   snurp: {
//   //     refTime: [],
//   //     hup: { start: 0, x: 0, isDope: false },
//   //     ups: [1, 2, 3, 4, 5],
//   //     derp: 0,
//   //     bla: 'yuzi',
//   //   },
//   //   updated: 0,
//   //   created: 0,
//   //   mep: 0,
//   //   flap: 0,
//   //   value: 666,
//   //   nip: 'FRANKO!',
//   //   gerp: 999,
//   // })

//   // const doesNotExist = db.get('simple', 0)

//   // // TODO franky when DBI does not exist and error zig will never work again...
//   // t.deepEqual(doesNotExist, {
//   //   location: { lat: 0, long: 0 },
//   //   user: 0,
//   //   vectorClock: 0,
//   // })

//   // const id1 = db.create('simple', {
//   //   user: 1,
//   //   vectorClock: 20,
//   //   location: {
//   //     long: 52.0123,
//   //     lat: 52.213,
//   //   },
//   // })

//   // await wait(0)
//   // t.is(Math.round(db.get('simple', id1).location.long * 10000) / 10000, 52.0123)

//   // const refs = []
//   // for (let i = 0; i < 1e4; i++) {
//   //   refs.push(i)
//   // }

//   // const id2 = db.create('vote', {
//   //   user: 1,
//   //   vectorClock: 22,
//   //   location: {
//   //     long: 52.1,
//   //     lat: 52.2,
//   //   },
//   //   refs,
//   // })
//   // await wait(0)
//   // t.is(db.get('vote', id2).vectorClock, 22)
//   // t.is(db.get('vote', id2).refs.length, 1e4)

//   // let d = Date.now()
//   // let lId = 0
//   // for (let i = 0; i < 2e6; i++) {
//   //   lId = db.create('simple', {
//   //     user: 1,
//   //     vectorClock: i,
//   //     location: {
//   //       long: 52,
//   //       lat: 52,
//   //     },
//   //   })
//   // }
//   // await wait(0)
//   // console.info('perf', Date.now() - d, 'ms', '2M inserts (2 dbis)')

//   // t.deepEqual(db.get('simple', lId), {
//   //   user: 1,
//   //   vectorClock: 2e6 - 1,
//   //   location: {
//   //     long: 52,
//   //     lat: 52,
//   //   },
//   // })

//   t.true(true)
// })

// test.serial('get include', async (t) => {
//   try {
//     await fs.rm(dbFolder, { recursive: true })
//   } catch (err) {}
//   await fs.mkdir(dbFolder)

//   const db = new BasedDb({
//     path: dbFolder,
//   })

//   db.updateSchema({
//     types: {
//       something: {
//         fields: {
//           flap: { type: 'string' },
//           user: { type: 'reference', allowedType: 'user' },
//           vectorClock: { type: 'integer' },
//           location: {
//             type: 'object',
//             properties: {
//               long: { type: 'number' },
//               lat: { type: 'number' },
//             },
//           },
//         },
//       },
//     },
//   })

//   const id = db.create('something', {
//     user: 1,
//     flap: 'hello',
//     vectorClock: 20,
//     location: {
//       long: 52.0123,
//       lat: 52.213,
//     },
//   })

//   await wait(0)

//   // only query...
//   console.info(db.get('something', id, ['location.long', 'flap']))

//   t.pass()
// })

// function generateRandomArray() {
//   var array = []
//   for (var i = 0; i < 5; i++) {
//     array.push(Math.floor(Math.random() * 20) + 1)
//   }
//   return array
// }

test.serial.only('query + filter', async (t) => {
  await wait(100)

  try {
    await fs.rm(dbFolder, { recursive: true })
  } catch (err) {}
  await fs.mkdir(dbFolder)
  const db = new BasedDb({
    path: dbFolder,
  })

  db.updateSchema({
    types: {
      user: {
        fields: {
          name: { type: 'string' },
          email: { type: 'string' },
          age: { type: 'integer' },
        },
      },
      simple: {
        fields: {
          user: { type: 'reference', allowedType: 'user' },
          vectorClock: { type: 'integer' },
          flap: { type: 'string' },
          refs: { type: 'references', allowedType: 'user' },
          location: {
            type: 'object',
            properties: {
              bla: { type: 'integer' },
              long: { type: 'integer' },
              lat: { type: 'integer' },
            },
          },
          smurp: {
            type: 'object',
            properties: {
              hello: { type: 'boolean' },
              ts: { type: 'timestamp' },
              pos: {
                type: 'object',
                properties: {
                  x: { type: 'integer' },
                  y: { type: 'integer' },
                },
              },
            },
          },
        },
      },
    },
  })

  const users = []

  for (let i = 0; i < 1; i++) {
    users.push(
      db.create('user', {
        age: i,
        name: 'Mr ' + i,
        email: i + '@once.net',
      }),
    )
  }

  await wait(0)

  const amount = 10
  for (let i = 0; i < amount - 1; i++) {
    db.create('simple', {
      user: users[~~(Math.random() * users.length)],
      vectorClock: 6 + i,
      location: {
        bla: 3,
        long: 1,
        lat: 2,
      },
    })
  }

  await wait(0)

  const result = db
    .query('simple')
    .filter('vectorClock', '>', 1)
    .include('vectorClock', 'location')
    .range(0, 2)
    .get()

  for (const x of result.data) {
    console.log('X', x.toObject())
  }

  // const bla = result.data.map((v) => {
  //   // return { ...v }
  //   console.log(v.propertyIsEnumerable('__t'))

  //   console.log(v, 'x', v.constructor.prototype)
  // })

  // toJSON
  // toObject

  // toString

  // util inspect for nodes

  // non enum on node for __o __q

  // iterator
  // nodes

  await wait(0)

  t.true(true)
})
