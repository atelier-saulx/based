import { wait } from '@saulx/utils'
import { fileURLToPath } from 'url'
import { BasedDb } from '../../src/index.js'
import { join, dirname, resolve } from 'path'
import fs from 'node:fs/promises'
import { text, italy, euobserver } from './examples.js'
import * as q from '../../src/query/internal/internal.js'

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
    user: {
      props: {
        name: 'string',
        bla: {
          ref: 'article',
          prop: 'bla',
        },
        articles: {
          items: {
            ref: 'article',
            prop: 'contributors',
          },
        },
      },
    },
    country: {
      props: {
        code: { type: 'string', maxBytes: 2 },
        name: 'string',
      },
    },
    article: {
      props: {
        name: 'string',
        burp: [1, 2],
        published: 'boolean',
        bla: {
          ref: 'user',
          prop: 'bla',
        },
        contributors: {
          type: 'references',
          items: {
            ref: 'user',
            prop: 'articles',
            $role: ['writer', 'editor'],
          },
        },
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

// --------------------------------------------------------------

const def = q.createQueryDef(db, q.QueryDefType.Root, {
  type: 'article',
  ids: new Uint32Array([1, 2]),
})

q.includeFields(def, [
  'published',
  'name',
  'contributors.name',
  'contributors.$role',
])

q.sort(def, 'name', 'desc')

console.log(q.debug(q.defToBuffer(db, def)))

// console.log(
//   new Uint8Array(
//     db
//       .query('article')
//       .include(
//         ...['published', 'name', 'contributors.name', 'contributors.$role'],
//       )
//       .toBuffer().include,
//   ),
// )

// how to do make a funciton and the include type def
// no query constructor yet just fns where we can add include stuff to the include def
// combine them and create the buffer
// then execute on db
// give it a different name
// QueryDef scince its all
// todo make a full toObject() speedy (later)
// use this queryDef to read things
// then at the end we can make the Query Constructor thing
// this makes the query irrelevant everywhere else except the nessecary info of include
// big thing only type to store things
// easy functions to create things
// then put it together afterwards
