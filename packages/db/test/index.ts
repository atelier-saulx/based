// import test from 'ava'
import { wait } from '@saulx/utils'
import { fileURLToPath } from 'url'
import fs from 'node:fs/promises'
import { BasedDb } from '../src/index.js'
import { join, dirname, resolve } from 'path'
import { text } from './examples.js'
import native from '../src/db.js'
import zlib from 'node:zlib'

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
        flap: { type: 'integer' },
        email: { type: 'string', maxLength: 15 }, // maxLength: 10
        age: { type: 'integer' },
        snurp: { type: 'string' },
        burp: { type: 'integer' },
        location: {
          type: 'object',
          properties: {
            label: { type: 'string' },
            x: { type: 'integer' },
            y: { type: 'integer' },
          },
        },
      },
    },
    simple: {
      // min max on string
      fields: {
        // countryCode: { type: 'string' },
        // derp: { type: 'integer' },
        // add bytelenght as option
        // also add a bytes field
        // @ts-ignore
        // @ts-ignore
        // countryCode: { type: 'string' },
        countryCode: { type: 'string', maxBytes: 2 },
        email: { type: 'string', maxLength: 15 }, // maxLength: 10

        writer: { type: 'reference', allowedType: 'user' },

        // name: { type: 'string', maxLength: 10 },
        user: { type: 'reference', allowedType: 'user' },
        vectorClock: { type: 'integer' },
        flap: { type: 'string' },

        nested: {
          type: 'object',
          properties: {
            bla: { type: 'reference', allowedType: 'user' },
          },
        },
        // refs: { type: 'references', allowedType: 'user' },
        // location: {
        //   type: 'object',
        //   properties: {
        //     bla: { type: 'integer' },
        //     long: { type: 'number' },
        //     lat: { type: 'number' },
        //   },
        // },
        // smurp: {
        //   type: 'object',
        //   properties: {
        //     hello: { type: 'boolean' },
        //     ts: { type: 'timestamp' },
        //     pos: {
        //       type: 'object',
        //       properties: {
        //         x: { type: 'integer' },
        //         y: { type: 'integer' },
        //       },
        //     },
        //   },
        // },
      },
    },
  },
})

const users = []

for (let i = 0; i < 1000; i++) {
  users.push(
    db.create('user', {
      age: 99,
      name: 'Mr ' + i,
      burp: 66,
      snurp: 'derp derp',
      email: 'merp_merp_' + i + '@once.net',
      location: {
        label: 'BLA BLA',
      },
    }),
  )
}

await wait(0)

const amount = 5e6
const d = Date.now()
for (let i = 0; i < amount; i++) {
  db.create('simple', {
    writer: users[~~(Math.random() * users.length)], // TODO: add setting on other field as well...
    // name: 'Jim de Beer',
    user: users[~~(Math.random() * users.length)], // TODO: add setting on other field as well...
    vectorClock: ~~(Math.random() * 10000),
    // derp: ~~(Math.random() * 10000),
    // flap: ,
    flap: '000000000',
    email: 'bla' + i + '@once.net',

    countryCode: 'aa',

    nested: {
      bla: users[~~(Math.random() * users.length)], // TODO: add setting on other field as well...
    },
    // countryCode: Math.random() > 0.5 ? 'en' : 'de',
    // refs: [1, 2, 3],
    // smurp: {
    //   ts: Date.now(),
    // },
    // location: {
    //   bla: 3,
    //   long: 1,
    //   lat: 2,
    // },
  })
}

await wait(0)
console.log('TIME', Date.now() - d, 'ms')

const result = db
  .query('simple')

  .filter('vectorClock', '>', 500)
  .include('countryCode')
  .include('countryCode')

  // .include('email')

  // same include multiple time ERROR
  .include('user.age')
  // .include('user.burp')
  // // .include('user.name')
  // // .include('user.snurp')
  // .include('user.email')

  // .include('nested.bla.age')

  // .include('user.location.label')
  .include('vectorClock')
  .range(0, 2)
  // sort()
  .get()

const team = {
  matches: [1, 2, 5],
}

// loop
// id SORT PUBLISHDATE
//

/*
[timestamp]: {id}
[timestamp]: {id}





*/

// const result2 = db.query('user').range(0, 10).get()

// INDEX MAKING - reigsiter to index / unregister to index
// + 1 / - 1

console.log(result)
// maybe start with subscription caches before refs
// make it work with UPDATING the query result

// console.log(zlib.deflateSync(JSON.stringify(result.data.toObject())))

console.log(new Uint8Array(result.buffer), result.data.length)

let i = 0

// console.info(result.data.toObject())

// for (const item of result.data) {
//   if (i > 3) {
//     break
//   }
// }

// for (const item of result.data) {
//   console.info(item)
// }

for (const item of result.data) {
  console.info('\n| ITEM ID --->', item.id)

  // console.info('| USER NAME--->', item.user.name)
  console.info('| USER AGE--->', item.user.age)
  // console.info('| USER BURP--->', item.user.burp)

  // console.info('| NESTED BLA AGE--->', item.nested.bla.age)

  // console.info('| USER SNURP--->', item.user.snurp)
  // console.info('| USER EMAIL--->', item.user.email)
  i++
  // console.info('| USER LOCATION--->', item.user.location.label)
  // console.info('| USER TOTAL--->', item.user.toObject()) // fix
  if (i > 3) {
    break
  }
}

// FIX TREE

// console.log(result.)

// ExecTime: 452.56 ms 5M list

// pin // allow query to have an async flag - can add automaticly in building

await wait(0)

// t.true(true)
// })
