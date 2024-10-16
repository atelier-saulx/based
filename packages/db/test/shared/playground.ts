import { wait } from '@saulx/utils'
import { fileURLToPath } from 'url'
import { BasedDb } from '../../src/index.js'
import { join, dirname, resolve } from 'path'
import fs from 'node:fs/promises'
import { italy } from './examples.js'
import * as q from '../../src/query/query.js'

const __dirname = dirname(fileURLToPath(import.meta.url).replace('/dist/', '/'))
const relativePath = '../../tmp'
const dbFolder = resolve(join(__dirname, relativePath))

await wait(100)

try {
  await fs.rm(dbFolder, { recursive: true })
} catch (err) {}

const db = new BasedDb({
  path: dbFolder,
})

await db.start()

const role = ['creator', 'editor', 'reader']

db.putSchema({
  types: {
    todo: {
      props: {
        file: { type: 'string' },
        name: { type: 'string' },
        body: { type: 'string' },
        done: { type: 'boolean' },
        address: {
          props: {
            street: 'string',
            nr: 'uint32',
            postalCode: 'uint16',
            city: {
              props: {
                name: 'string',
                location: {
                  props: {
                    long: 'number',
                    lat: 'number',
                  },
                },
              },
            },
          },
        },
        collaborators: {
          items: {
            ref: 'user',
            prop: 'todos',
            $role: role,
          },
        },
      },
    },
    user: {
      props: {
        name: { type: 'string', max: 100 },
        age: { type: 'number', step: 1, min: 0, max: 200 },
        todos: {
          items: {
            ref: 'todo',
            prop: 'collaborators',
          },
        },
      },
    },
  },
})

const mrDerp = await db.create('user', { name: 'mr derp' })
// db.drain()

for (let i = 0; i < 1e4; i++) {
  db.create('todo', {
    done: !!(i % 2),
    name: 'flap ' + i,
    body: italy,
    address: {
      street: 'kanaalstraat',
      nr: 102,
      postalCode: 50123,
      city: {
        name: 'amsterdam',
        location: {
          long: 52.12,
          lat: 52.23,
        },
      },
    },
    collaborators: [
      {
        id: mrDerp,
        $role: role[Math.floor(Math.random() * role.length)],
      },
    ],
  })
}

console.log(db.drain())

console.log(db.query('todo').filter('done').range(0, 1000).get())

// const d = Date.now()

// for (let i = 0; i < 5e6; i++) {
//   db.create('todo', { done: false, age: i })
// }

// for (let i = 0; i < 1e6; i++) {
//   db.create('user', {
//     flap: ~~(Math.random() * 10),
//     name: 'my flap ' + (i + 2) + '!',
//   })
// }

// const ids: any = new Set()
// const x = 100
// for (let j = 0; j < x; j++) {
//   ids.add(~~(Math.random() * 1e6 - 1) + 1)
// }

// const y = [1, ...ids.values()].sort()

// // .map((v) => {
// //   return {
// //     id: v,
// //     // $friend: mrDerp,
// //     // $friends: [mrDerp],
// //     $role: 'writer',
// //   }
// // })

// for (let i = 0; i < 1e5; i++) {
//   db.create('article', {
//     flap: (i % 2) * 10,
//     name: 'Ultra article ' + i,
//     published: !!(i % 2),
//     burp: ['derp', 'flappie'][i % 2],
//     owner: 1,
//     favouritedBy: [1],
//     contributors: y,
//   })
// }

// // BasedUserQueryFunction
// // BasedUserQuerySession

// console.log('db time', db.drain(), Date.now() - d)

// const r = db
//   .query('article')
//   // .filter('flap', '>', 1)
//   // .filter('pbulished', '>', 1)
//   // .filter('burp', '=', 'derp')
//   .include('contributors', 'name', 'flap', 'burp')
//   // .include((s) => {
//   //   s('contributors')
//   //     .filter('name', '=', 'mr derp')
//   //     .include('name', '$role', 'favourite')
//   // })
//   .range(0, 5e6)
//   // .sort('name', 'desc')
//   .get()

// console.log(r)
// // r.debug()

// // console.dir(r.toObject(), { depth: 10 })
// // console.log(r)

// q.debug(q.defToBuffer(db, r.def))

// var yy = Date.now()

// 'contributors',
// .include('name', 'flap', 'burp')
// for (let i = 0; i < 1e6; i++) {
//   // allow arrays
//   q.defToBuffer(db, db.query('article').def)
// }
// console.log(Date.now() - yy, 'ms')

// const r2 = db
//   .query('article')
//   .include((s) => {
//     s('contributors').include('*')
//   })
//   .range(10, 3)
//   .get()

// r.debug()
