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
        myBlup: { type: 'reference', allowedType: 'blup' },
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
        // countryCode: { type: 'string' },
        // derp: { type: 'integer' },
        // add bytelenght as option
        // also add a bytes field
        // @ts-ignore
        // @ts-ignore
        // countryCode: { type: 'string' },
        countryCode: { type: 'string', maxBytes: 2 },
        // email: { type: 'string', maxLength: 15 }, // maxLength: 10

        // writer: { type: 'reference', allowedType: 'user' },
        lilBlup: { type: 'reference', allowedType: 'blup' },

        // // name: { type: 'string', maxLength: 10 },
        vectorClock: { type: 'integer' },
        user: { type: 'reference', allowedType: 'user' },

        // flap: { type: 'string' },

        // smuro: {
        //   type: 'object',
        //   properties: {
        //     flap: { type: 'string' },
        //   },
        // },

        // nested: {
        //   type: 'object',
        //   properties: {
        //     bla: { type: 'reference', allowedType: 'user' },
        //   },
        // },
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

const blup = db.create('blup', {
  name: 'blup !',
  flap: 'A',
})

for (let i = 0; i < 50; i++) {
  // console.log({ blup })
  const blup = db.create('blup', {
    name: 'blup ! ' + i,
    flap: 'A',
  })

  users.push(
    db.create('user', {
      myBlup: blup,
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

const amount = 1e6
const d = Date.now()
for (let i = 0; i < amount; i++) {
  db.create('simple', {
    // writer: users[~~(Math.random() * users.length)], // TODO: add setting on other field as well...
    // // name: 'Jim de Beer',
    user: users[~~(Math.random() * users.length)], // TODO: add setting on other field as well...
    vectorClock: i,
    // // derp: ~~(Math.random() * 10000),
    // // flap: ,
    // flap: 'AAA',
    // email: 'bla' + i + '@once.net',

    countryCode: 'aa',
    lilBlup: 1,
    // smuro: {
    //   flap: 'flap',
    // },
    // nested: {
    //   bla: users[~~(Math.random() * users.length)], // TODO: add setting on other field as well...
    // },
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

  // .include('id')
  // .filter('vectorClock', '<', 4)
  // add filter by ref!

  // .include('countryCode')
  // .include('vectorClock')
  // .include('flap')

  // .include('id')

  // .include('lilBlup')
  // .include('user') // includes all EXCEPT REFS
  // .include('user.myBlup.name')

  .include('user.myBlup.id')

  // .include('user.age')
  // just having
  // include user allrdy...
  // .include('user.age')

  // .include('user.myBlup.name')

  // design TIME

  // 2 ids
  // 6 ids  -> 16
  // 4 "A" flap -> 8
  // 2 age (4 bytes) -> 16 (40 bytes min, 40 bytes)

  // .include('lilBlup.name')

  // .include('user.age')
  // .include('user.name')

  // .include('user.myBlup.flap')
  // .include('user.myBlup.name')x

  // .include('countryCode')
  // .include('smuro.flap')

  // .include('email')

  // same include multiple time ERROR

  // .include('user.myBlup.name')

  // .include('user.burp')
  // // .include('user.name')
  // // .include('user.snurp')
  // .include('user.email')

  // .include('nested.bla.age')

  // .include('user.location.label')
  // .include('vectorClock')
  .range(0, 3)
  // sort()
  .get()

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

const logger = (x, empty = '') => {
  for (const key in x) {
    if (key === 'fromRef') {
      console.log(empty, key, ':', `[${x[key].path.join('.')}]`)
    } else if (key !== 'schema' && key !== 'includeTree') {
      if (key === 'refIncludes') {
        console.log(empty, ' -- ref includes!')
        for (const k in x[key]) {
          console.log(empty, ' -- STARRT: ', k)
          logger(x[key][k], empty + '  ')
        }
      } else {
        console.log(empty, key, ':', x[key])
      }
    }
  }
  if (!empty) {
    console.log('\n')
  }
}

logger(result.query.includeDef)

// maybe start with subscription caches before refs
// make it work with UPDATING the query result

// console.log(zlib.deflateSync(JSON.stringify(result.data.toObject())))

console.log(new Uint8Array(result.buffer), result.data.length)

let i = 0

console.dir(result.data.toObject(), { depth: 10 })

console.log(result)

// for (const item of result.data) {
//   if (i > 3) {
//     break
//   }
// }

// for (const item of result.data) {
//   console.info(item)
// }

console.log('GOP GP')

for (const item of result.data) {
  console.info('\nITEM ID --->', item.id)
  // console.info('| FLAP--->', item.flap)
  // console.info('| COUNTRY--->', item.countryCode)
  // console.info('| lilBlup --->', item.lilBlup)

  // console.info('| lilBlup FLAP--->', item.lilBlup.flap)
  // console.info('| lilBlup NAME--->', item.lilBlup.name)
  console.info('| lilBlup id--->', item.user.myBlup.id)

  // console.info('| user age--->', item.user.age)
  // console.info('| user id--->', item.user.id) // bit wrong scince it can not exist...
  // console.info('| flap--->', item.flap)
  // console.info('| user.myBlup.flap--->', item.user.myBlup.flap)
  // console.info('user.myBlup.name--->', item.user.myBlup.name)
  // console.info('user.myBlup.id--->', item.user.myBlup.id)

  // console.info('user.id--->', item.user.id)

  i++

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
