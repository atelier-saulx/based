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
        myBlup: { type: 'reference', allowedType: 'blup' },
        name: { type: 'string' },
        flap: { type: 'integer' },
        email: { type: 'string', maxLength: 14 }, // maxLength: 10 // maxLength: 15
        snurp: { type: 'string' },
        // burp: { type: 'integer' },
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
        // @ts-ignore
        countryCode: { type: 'string', maxBytes: 2 },
        lilBlup: { type: 'reference', allowedType: 'blup' },
        // vectorClock: { type: 'integer' },
        user: { type: 'reference', allowedType: 'user' },
      },
    },
  },
})

const users = []

const amount = 1e6

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
      age: i, // ~~(Math.random() * 99) + 1,
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

// db.drain()

// for (let i = 0; i < amount; i++) {
//   db.create('simple', {
//     // this can be optmized by collecting the refs then go trough them in order
//     // so you add the ids in order in a 'ordered list

//     user: i + 1,
//     // 3x slower with random access
//     // user: users[~~(Math.random() * users.length)], // TODO: add setting on other field as well...
//     // vectorClock: i,
//     // countryCode: 'aa',
//     lilBlup: 1,
//   })
// }

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

// const logger = (x, empty = '') => {
//   for (const key in x) {
//     if (key === 'fromRef') {
//       console.log(empty, key, ':', `[${x[key].path.join('.')}]`)
//     } else if (key !== 'schema' && key !== 'includeTree') {
//       if (key === 'refIncludes') {
//         console.log(empty, ' -- ref includes!')
//         for (const k in x[key]) {
//           console.log(empty, ' -- STARRT: ', k)
//           logger(x[key][k], empty + '  ')
//         }
//       } else {
//         console.log(empty, key, ':', x[key])
//       }
//     }
//   }
//   if (!empty) {
//     console.log('\n')
//   }
// }

// logger(result.query.includeDef)

// console.log(new Uint8Array(result.buffer), result.data.length)

// console.dir(result.data.toObject(), { depth: 10 })

// db.create('user', {
//   // myBlup: blup,
//   // age: amount - i
//   age: 0,
//   // name: 'Mr ' + i,
//   // burp: 66,
//   name: 'A MR POEPOE',
//   // snurp: 'derp derp',
//   // email: 'merp_merp_' + i + '@once.net',
//   // location: {
//   // label: 'BLA BLA',
//   // },
// })

db.drain()

console.log(
  db.query('user').range(0, 5e5).include('name', 'age').sort('name').get(),
)

console.log(
  db.query('user').range(0, 5e5).include('name', 'age').sort('name').get(),
)

// for (const item of result.data) {
//   // console.info('\nITEM ID --->', item.id)
//   // console.info('| FLAP--->', item.flap)
//   // console.info('| COUNTRY--->', item.countryCode)
//   // console.info('| lilBlup --->', item.lilBlup)
//   // console.info('| lilBlup FLAP--->', item.lilBlup.flap)
//   // console.info('| lilBlup NAME--->', item.lilBlup.name.length)

//   if (item.lilBlup.name.length > 0) {
//     console.log(
//       'WTF',
//       item.id,
//       item.lilBlup.name.length,
//       '?',
//       Buffer.from(item.lilBlup.name),
//     )
//     break
//   }
//   // console.info('| lilBlup id--->', item.user.myBlup.id)
//   // console.info('| user age--->', item.user.age)
//   // console.info('| user id--->', item.user.id) // bit wrong scince it can not exist...
//   // console.info('| flap--->', item.flap)
//   // console.info('| user.myBlup.flap--->', item.user.myBlup.flap)
//   // console.info('user.myBlup.name--->', item.user.myBlup.name)
//   // console.info('user.myBlup.id--->', item.user.myBlup.id)
//   // console.info('user.id--->', item.user.id)
//   i++
// }

// db.stats()

// db.tester()

await wait(0)
