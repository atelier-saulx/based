import { wait } from '@saulx/utils'
import { fileURLToPath } from 'url'
import fs from 'node:fs/promises'
import { BasedDb } from '../src/index.js'
import { join, dirname, resolve } from 'path'

const __dirname = dirname(fileURLToPath(import.meta.url).replace('/dist/', '/'))
const relativePath = '../tmp'
const dbFolder = resolve(join(__dirname, relativePath))

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
        age: { type: 'integer' },
        // myBlup: { type: 'reference', allowedType: 'blup' },
        name: { type: 'string' },
        flap: { type: 'integer' },
        email: { type: 'string', maxLength: 14 },
        // snurp: { type: 'string' },
        location: {
          type: 'object',
          properties: {
            // label: { type: 'string' },
            x: { type: 'integer' },
            y: { type: 'integer' },
          },
        },
      },
    },
    blup: {
      fields: {
        flap: {
          type: 'string',
          // @ts-ignore
          maxBytes: 1,
        },
        name: { type: 'string' },
      },
    },
    simple: {
      // min max on string
      fields: {
        // @ts-ignore
        countryCode: { type: 'string', maxBytes: 2 },
        lilBlup: { type: 'reference', allowedType: 'blup' },
        user: { type: 'reference', allowedType: 'user' },
      },
    },
  },
})

const users = []

const amount = 10e6

const d = Date.now()

for (let i = 0; i < amount; i++) {
  // const blup = db.create('blup', {
  //   // name: 'blup ! ' + i,
  //   flap: 'A',
  // })

  users.push(
    db.create('user', {
      // myBlup: blup,
      // age: amount - i
      age: ~~(Math.random() * 99) + 1,
      name: 'Mr ' + i,
      // burp: 66,
      // snurp: 'derp derp',
      // email: 'merp_merp_' + i + '@once.net',
      // location: {
      // label: 'BLA BLA',
      // },
    }),
  )
}

db.drain()

console.log(
  'Write',
  amount,
  'items',
  'total db time',
  db.writeTime,
  'ms',
  Date.now() - d,
  'ms\n',
)

db.drain()

console.log(
  db.query('user').range(0, 1e4).include('name', 'age').sort('age').get(),
)

console.log(
  db.query('user').range(0, 1e4).include('name', 'age').sort('age').get(),
)

const ids: Set<number> = new Set()
for (let i = 1; i < 1e4; i++) {
  // ids.add(~~(Math.random() * 1e6))
  ids.add(i)
}

// console.log(
//   db
//     .query('user', [...ids.values()])
//     .include('name', 'age')
//     .filter('age', '>', 50)
//     .sort('age')
//     .get(),
// )

const ids2: Set<number> = new Set()
for (let i = 1; i < 500; i++) {
  ids2.add(i)
}

console.log(
  db
    .query('user', [...ids2.values()])
    .include('name', 'age')
    .sort('age')
    .get(),
)

await wait(0)
