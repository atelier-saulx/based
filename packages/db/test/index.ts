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

for (let i = 0; i < 1000; i++) {
  users.push(
    db.create('user', {
      age: i,
      name: 'Mr ' + i,
      email: i + '@once.net',
    }),
  )
}

await wait(0)

const amount = 70e3
for (let i = 0; i < amount - 1; i++) {
  db.create('simple', {
    user: users[~~(Math.random() * users.length)],
    vectorClock: 6 + i,
    flap: text,
    refs: [1, 2, 3],
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

const result = db
  .query('simple')
  .filter('vectorClock', '>', 1)
  .include('vectorClock', 'location.bla', 'flap', 'refs', 'user', 'smurp')
  .range(0, 50e3)
  .get()

const result2 = db.query('user').range(0, 1e5).get()

console.log(result)

// for (const item of result.data) {
//   console.info(item)
// }

// for (const item of result.data) {
//   console.info(item)
// }

await wait(0)

// t.true(true)
// })
