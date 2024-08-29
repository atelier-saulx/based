import { wait } from '@saulx/utils'
import { fileURLToPath } from 'url'
import { BasedDb, schema2selva } from '../../src/index.js'
import { join, dirname, resolve } from 'path'

const __dirname = dirname(fileURLToPath(import.meta.url).replace('/dist/', '/'))
const relativePath = '../../tmp'
const dbFolder = resolve(join(__dirname, relativePath))

await wait(100)

// try {
//   await fs.rm(dbFolder, { recursive: true })
// } catch (err) {}

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

db.updateSchema({
  types: {
    user: {
      fields: {
        age: { type: 'integer' },
        time: { type: 'integer' },
        fun: { type: 'integer' },
        name: { type: 'string', maxLength: 15 },
        flap: { type: 'string' },
      },
    },
    xyz: {
      fields: {
        age: { type: 'integer' },
        time: { type: 'integer' },
        fun: { type: 'integer' },
        name: { type: 'string' },
        flap: { type: 'string' },
      },
    },
  },
})

await db.start()

let types = Object.keys(db.schemaTypesParsed)
const s = schema2selva(db.schemaTypesParsed)
for (let i = 0; i < s.length; i++) {
  // types
  const type = db.schemaTypesParsed[types[i]]
  db.native.updateSchemaType(type.prefixString, s[i])
}

/*
  age: ~~(Math.random() * 99) + 1,
  name: 'Mr ' + i,
*/

console.log('SNURP')

var d = Date.now()
for (let i = 0; i < 10e6; i++) {
  db.create('user', {
    time: 1,
    fun: 2,
    age: 99,
    name: 'Mr nurp nurp ' + i,
  })
  // Relatively slow remove schema lookup
  // db.create('xyz', {
  //   name: 'Mr X!',
  //   flap: 'BLA',
  // })
}

const dbTime = db.drain()

console.log(Date.now() - d, dbTime, 'ms')

// await db.start()

// db.updateSchema({
//   types: {
//     user: {
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
//     blup: {
//       fields: {
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
//       fields: {
//         // @ts-ignore
//         countryCode: { type: 'string', maxBytes: 2 },
//         lilBlup: { type: 'reference', allowedType: 'blup' },
//         user: { type: 'reference', allowedType: 'user' },
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
