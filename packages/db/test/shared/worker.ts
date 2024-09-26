// import { wait } from '@saulx/utils'
// import { fileURLToPath } from 'url'
// import { BasedDb } from '../../src/index.js'
// import { join, dirname, resolve } from 'path'
// import { workerData } from 'node:worker_threads'

// console.log('start worker...')

// const __dirname = dirname(fileURLToPath(import.meta.url).replace('/dist/', '/'))

// // const nr = ~~(Math.random() * 999999)

// const relativePath = '../../tmp/'

// const dbFolder = resolve(join(__dirname, relativePath))

// console.log('WORKER DB', dbFolder)

// const db = new BasedDb({
//   path: dbFolder,
//   //   maxModifySize: 1000000,
// })

// await db.start()

// await wait(100)

// // const user = nr + 'user'

// const user = 'user'

// db.putSchema({
//   types: {
//     [user]: {
//       fields: {
//         age: { type: 'integer' },
//         myBlup: { type: 'reference', allowedType: 'blup' },
//         name: { type: 'string' },
//         flap: { type: 'integer' },
//         email: { type: 'string', maxLength: 14 },
//         snurp: { type: 'string' },
//         location: {
//           type: 'object',
//           properties: {
//             label: { type: 'string' },
//             x: { type: 'integer' },
//             y: { type: 'integer' },
//           },
//         },
//       },
//     },
//   },
// })

// // if (workerData === 0) {
// //   const users = []

// //   const amount = 1e6

// //   const d = Date.now()

// //   for (let i = 0; i < amount; i++) {
// //     // const blup = db.create('blup', {
// //     //   // name: 'blup ! ' + i,
// //     //   flap: 'A',
// //     // })

// //     users.push(
// //       db.create(user, {
// //         // myBlup: blup,
// //         // age: amount - i
// //         age: ~~(Math.random() * 99) + 1,
// //         name: 'Mr ' + i,
// //         // burp: 66,
// //         // snurp: 'derp derp',
// //         // email: 'merp_merp_' + i + '@once.net',
// //         // location: {
// //         // label: 'BLA BLA',
// //         // },
// //       }),
// //     )
// //   }

// //   db.drain()

// //   console.log(
// //     'Write',
// //     amount,
// //     'items',
// //     'total db time',
// //     db.writeTime,
// //     'ms',
// //     Date.now() - d,
// //     'ms\n',
// //   )
// // }

// // console.log(
// //   db.query('user').range(0, 1e4).include('name', 'age').sort('name').get(),
// // )

// // console.log(
// //   db.query(user).range(0, 1e4).include('name', 'age').sort('age').get(),
// // )

// // console.log(
// //   db.query(user).range(0, 1e4).include('name', 'age').sort('age').get(),
// // )

// // const ids: Set<number> = new Set()
// // for (let i = 1; i < 1e4; i++) {
// //   ids.add(~~(Math.random() * 10e6))
// //   // ids.add(i)
// // }

// // // console.log(
// // //   db
// // //     .query('user', [...ids.values()])
// // //     .include('name', 'age')
// // //     .filter('age', '>', 50)
// // //     .sort('age')
// // //     .get(),
// // // )

// // const ids2: Set<number> = new Set()
// // for (let i = 1; i < 5000; i++) {
// //   ids2.add(~~(Math.random() * 10e6))

// //   // ids2.add(i)
// // }
// if (workerData !== 0) {
//   // .sort('age')
//   //   console.log(db.query(user).include('name', 'age').range(0, 1e5).get())
// }

// await wait(0)

// console.log('RDY')

// // await db.destroy()

// // console.log(
// //   'WORKER',
// //   db
// //     .query('user')
// //     .range(0, 1e6)
// //     .include('name', 'age')
// //     // .sort('age')
// //     .get(),
// // )

// db.query('user')
//   .range(0, 1e6)
//   // .include('name', 'age')
//   // .sort('age')
//   .get()
