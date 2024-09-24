import { wait } from '@saulx/utils'
import { fileURLToPath } from 'url'
import { BasedDb } from '../../src/index.js'
import { join, dirname, resolve } from 'path'
import fs from 'node:fs/promises'
import { text, italy, euobserver } from './examples.js'

const __dirname = dirname(fileURLToPath(import.meta.url).replace('/dist/', '/'))
const relativePath = '../../tmp'
const dbFolder = resolve(join(__dirname, relativePath))

await wait(100)

try {
  await fs.rm(dbFolder, { recursive: true })
} catch (err) {}

// // console.log(__dirname)
// // const nr = 10

// const getWorker = (i) =>
//   new Promise((resolve, reject) => {
//     // const s = spawn('node', [
//     //   join(dirname(fileURLToPath(import.meta.url)), '/worker.js'),
//     // ])

//     const s = new Worker(
//       join(dirname(fileURLToPath(import.meta.url)), '/worker.js'),
//       { workerData: i },
//     )

//     s.on('error', (err) => {
//       reject(err)
//     })

//     s.stderr.on('data', (data) => {
//       console.log(`stderr: ${i} ${data}`)
//     })

//     s.stdout.on('data', (data) => {
//       console.log(`stdout: ${i} ${data}`)
//       if (`${data}`.includes('RDY')) {
//         resolve(true)
//       }
//     })

//     // s.stderr.on('data', (data) => {
//     // console.error(`stderr: ${i} ${data}`)
//     // })
//   })

// const q = []

// // var d = Date.now()
// // let doneCount = 0

// // await getWorker(0)
// // await getWorker(1)

// // for (let i = 1; i < nr; i++) {
// //   q.push(getWorker(i))
// // }

// // await Promise.all(q)

// // const x = new Worker(
// //   join(dirname(fileURLToPath(import.meta.url)), '/worker.js'),
// // )

// // console.log(__dirname)
// // const y = new Worker(
// //   join(dirname(fileURLToPath(import.meta.url)), '/worker.js'),
// // )

// await wait(100)

const db = new BasedDb({
  path: dbFolder,
})

await db.start()

db.updateSchema({
  types: {
    todo: {
      props: {
        name: { type: 'string' },
        done: { type: 'boolean' },
        age: { type: 'uint32' },
      },
    },
    user: {
      props: {
        // @ts-ignore
        flap: { type: 'string', maxBytes: 1 },
        age: { type: 'uint32' },
        xyz: {
          type: 'reference',
          ref: 'xyz',
          prop: 'user',
        },
        xyz2: {
          type: 'reference',
          ref: 'xyz',
          prop: 'user2',
        },
      },
    },
    xyz: {
      props: {
        age: { type: 'uint32' },
        user: {
          type: 'reference',
          ref: 'user',
          prop: 'xyz',
        },
        user2: {
          type: 'reference',
          ref: 'user',
          prop: 'xyz2',
        },
      },
    },
  },
})

for (let i = 0; i < 20e6; i++) {
  db.create('todo', { done: false, age: i })
}

console.log('db time', db.drain())

console.log(db.query('todo').range(0, 100).get())

// const user1 = db.create('user', {
//   age: 66,
//   flap: 'A',
//   xyz: db.create('xyz', { age: 98 }),
// })

// // db.create('user', {
// //   age: 102,
// // })

// db.create('user', {
//   age: 67,
//   xyz: db.create('xyz', { age: 99, user2: user1 }),
// })

// db.drain()

// console.log('drained')

// const result = db
//   .query('user')
//   .include('xyz2')
//   .include('xyz.user2')
//   .include('xyz.user2.xyz2')
//   .get()

// let i = 0
// for (const x of result) {
//   if (i === 1) {
//     // id of user has to be 1
//     console.log(x)
//   }
//   i++
// }

// console.log(result)

// /*
//   age: ~~(Math.random() * 99) + 1,
//   name: 'Mr ' + i,
// */

// console.log('SNURP')

// var d = Date.now()
// for (let i = 0; i < 10000; i++) {
//   db.create('user', {
//     age: i,
//     time: 66,
//     fun: 99,
//     name: euobserver,
//   })
//   // Relatively slow remove schema lookup
//   // db.create('xyz', {
//   //   name: 'Mr X!',
//   //   flap: 'BLA',
//   // })
// }

// const dbTime = db.drain()

// console.log(Date.now() - d, dbTime, 'ms')

// // sort('age').
// console.log(db.query('user').range(0, 1000).get())

// const dd = db.query('user').range(0, 100).get()

// console.log(dd)

// // for (const x of dd) {
// // console.log('???', x.name)
// // }

// await db.stop()

// await wait(1e3)

// console.log('STOP rdy')

// const db2 = new BasedDb({
//   path: dbFolder,
// })

// await db2.start()

// const flap = db2
//   .query('user')
//   .filter('name', 'has', 'mr poopoo')
//   .range(0, 100)
//   .get()

// console.log(flap)

// let i = 0
// for (const x of flap) {
//   i++
//   if (i > 999999) {
//     console.log(x.name)
//   }
// }

// db.updateSchema({
//   types: {
//     user: {
//       props: {
//         age: { type: 'uint32' },
//         myBlup: { type: 'reference', ref: 'blup' },
//         name: { type: 'string' },
//         flap: { type: 'uint32' },
//         email: { type: 'string', maxLength: 14 },
//         snurp: { type: 'string' },
//         location: {
//           type: 'object',
//           properties: {
//             label: { type: 'string' },
//             x: { type: 'uint32' },
//             y: { type: 'uint32' },
//           },
//         },
//       },
//     },
//     blup: {
//       props: {
//         flap: {
//           type: 'string',
//           // @ts-ignore
//           maxBytes: 1,
//         },
//         name: { type: 'string' },
//       },
//     },
//     simple: {
//       // min max on string
//       props: {
//         // @ts-ignore
//         countryCode: { type: 'string', maxBytes: 2 },
//         lilBlup: { type: 'reference', ref: 'blup' },
//         user: { type: 'reference', ref: 'user' },
//       },
//     },
//   },
// })

// const users = []

// const amount = 22e5

// const d = Date.now()

// for (let i = 0; i < amount; i++) {
//   // const blup = db.create('blup', {
//   //   // name: 'blup ! ' + i,
//   //   flap: 'A',
//   // })

//   users.push(
//     db.create('user', {
//       // myBlup: blup,
//       // age: amount - i
//       age: ~~(Math.random() * 99) + 1,
//       name: 'Mr ' + i,
//       // burp: 66,
//       // snurp: 'derp derp',
//       // email: 'merp_merp_' + i + '@once.net',
//       // location: {
//       // label: 'BLA BLA',
//       // },
//     }),
//   )
// }

// db.drain()

// console.log(
//   'Write',
//   amount,
//   'items',
//   'total db time',
//   db.writeTime,
//   'ms',
//   Date.now() - d,
//   'ms\n',
// )

// db.drain()

// // console.log(
// //   db.query('user').range(0, 1e4).include('name', 'age').sort('name').get(),
// // )

// console.log(
//   db.query('user').range(0, 1e4).include('name', 'age').sort('age').get(),
// )

// console.log(
//   db.query('user').range(0, 1e4).include('name', 'age').sort('age').get(),
// )

// const ids: Set<number> = new Set()
// for (let i = 1; i < 1e4; i++) {
//   ids.add(~~(Math.random() * 10e6))
//   // ids.add(i)
// }

// // console.log(
// //   db
// //     .query('user', [...ids.values()])
// //     .include('name', 'age')
// //     .filter('age', '>', 50)
// //     .sort('age')
// //     .get(),
// // )

// const ids2: Set<number> = new Set()
// for (let i = 1; i < 5000; i++) {
//   ids2.add(~~(Math.random() * 10e6))
//   // ids2.add(i)
// }

// console.log(
//   db
//     .query('user', [...ids2.values()])
//     .include('name', 'age')
//     .sort('age')
//     .get(),
// )

// // for (let i = 0; i < 10; i++) {
// //   q.push(getWorker(i + 1))
// // }

// const d2 = Date.now()

// await Promise.all(q)

// console.log(Date.now() - d2, 'ms')

// await wait(0)

// db.tester()
