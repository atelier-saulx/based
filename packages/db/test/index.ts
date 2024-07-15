// import test from 'ava'
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

// test.serial.only('query + filter', async (t) => {
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
      // min max on string
      fields: {
        // countryCode: { type: 'string' },

        // add bytelenght as option
        // also add a bytes field
        // @ts-ignore
        // @ts-ignore
        countryCode: { type: 'string', maxBytes: 2 },
        name: { type: 'string', maxLength: 10 },
        user: { type: 'reference', allowedType: 'user' },
        vectorClock: { type: 'integer' },
        flap: { type: 'string' },
        // refs: { type: 'references', allowedType: 'user' },
        location: {
          type: 'object',
          properties: {
            bla: { type: 'integer' },
            long: { type: 'number' },
            lat: { type: 'number' },
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

// for (let i = 0; i < 1000; i++) {
//   users.push(
//     db.create('user', {
//       age: i,
//       name: 'Mr ' + i,
//       email: i + '@once.net',
//     }),
//   )
// }

await wait(0)

const amount = 5e6
const d = Date.now()
for (let i = 0; i < amount; i++) {
  db.create('simple', {
    name: 'Jim de Beer',
    // user: users[~~(Math.random() * users.length)],
    vectorClock: ~~(Math.random() * 10000),
    // flap: text,
    flap: 'en',
    countryCode: 'en',
    // countryCode: Math.random() > 0.5 ? 'en' : 'de',
    // refs: [1, 2, 3],
    smurp: {
      ts: Date.now(),
    },
    location: {
      bla: 3,
      long: 1,
      lat: 2,
    },
  })
}

await wait(0)
console.log('TIME', Date.now() - d, 'ms')

const result = db
  .query('simple')

  // add field selection

  .filter('vectorClock', '>', 9990)
  .filter('countryCode', '=', 'en')

  .filter('flap', '=', 'en')

  // fix order...
  .include('countryCode', 'vectorClock', 'name', 'smurp', 'flap') // 'flap'
  .range(0, 1000)
  .get()

// const result2 = db.query('user').range(0, 10).get()

console.log(result)

// for (const item of result.data) {
//   console.info(item)
// }

for (const item of result.data) {
  console.info(item)
  break
}

// pin // allow query to have an async flag - can add automaticly in building

await wait(0)

// t.true(true)
// })
