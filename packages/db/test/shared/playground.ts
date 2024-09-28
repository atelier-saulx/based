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

db.putSchema({
  types: {
    todo: {
      props: {
        bla: { type: 'uint8' },
        name: { type: 'string' },
        done: { type: 'boolean' },
        age: { type: 'uint32' },
      },
    },
  },
})

const d = Date.now()

// for (let i = 0; i < 20e6; i++) {
//   db.create('todo', { done: false, age: i })
// }

// console.log('db time', db.drain(), Date.now() - d)

// console.log(db.query('todo').range(0, 100).get())

for (let i = 0; i < 2; i++) {
  db.create('todo', { done: true, age: i + 99, bla: 2 })
}

console.log('db time', db.drain(), Date.now() - d)

const x = db.query('todo').range(0, 100).get()

console.log(x.debug())

console.log(x)
