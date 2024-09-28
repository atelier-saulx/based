import { wait } from '@saulx/utils'
import { fileURLToPath } from 'url'
import { BasedDb } from '../../src/index.js'
import { join, dirname, resolve } from 'path'
import fs from 'node:fs/promises'
import { text, italy, euobserver } from './examples.js'
import {
  createQueryDef,
  debugQueryDef,
} from '../../src/query/internal/queryDef.js'
import { QueryDefType } from '../../src/query/internal/types.js'
import { includeFields } from '../../src/query/internal/props.js'
import { addInclude } from '../../src/query/internal/addInclude.js'
import { addRefInclude } from '../../src/query/internal/addRefInclude.js'
import { filter, filterToBuffer } from '../../src/query/internal/internal.js'

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
    user: {
      props: {
        flap: 'uint32',
        name: 'string',
        articles: {
          items: {
            ref: 'article',
            prop: 'contributors',
          },
        },
      },
    },
    article: {
      props: {
        name: 'string',
        contributors: {
          items: {
            ref: 'user',
            prop: 'articles',
          },
        },
      },
    },
    user2: {
      props: {
        name: 'string',
        bla: {
          ref: 'article2',
          prop: 'bla',
        },
        articles: {
          items: {
            ref: 'article2',
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
    article2: {
      props: {
        name: 'string',
        burp: [1, 2],
        bla: {
          ref: 'user2',
          prop: 'bla',
        },
        contributors: {
          type: 'references',
          items: {
            ref: 'user2',
            prop: 'articles',
            // $friend: {
            //   ref: 'user',
            // },
            // $countries: {
            //   items: {
            //     ref: 'country',
            //   },
            // },
            $role: ['writer', 'editor'],
            // $rating: 'uint32',
            // $lang: 'string',
            // $email: 'string',
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

for (let i = 0; i < 2; i++) {
  db.create('todo', { done: true, age: i + 99, bla: 2 })
}

console.log('db time', db.drain(), Date.now() - d)

var x = db.query('todo').range(0, 100).get()

console.log(x.debug())

console.log(x)

var def = createQueryDef(db, QueryDefType.Root, {
  type: 'todo',
})

includeFields(def, ['*'])

var buffer = addInclude(db, def)

debugQueryDef(def)

console.log(
  'old:',
  new Uint8Array(x.query.includeBuffer),
  'new:',
  new Uint8Array(Buffer.concat(buffer)),
)

console.log('-------------------------------------------------------------')

x = db.query('article').include('contributors.name').get()

def = createQueryDef(db, QueryDefType.References, {
  type: 'article',
  propDef: {
    typeIndex: 13,
    prop: 250,
    path: [],
    __isPropDef: true,
    len: 0,
    separate: true,
    name: 'root',
  },
})

includeFields(def, ['contributors.name'])

buffer = addRefInclude(db, def)

debugQueryDef(def)

console.log(
  'old:',
  new Uint8Array(x.query.includeBuffer),
  'new:',
  new Uint8Array(Buffer.concat(buffer)),
)

console.log('-------------------------------------------------------------')

x = db.query('article').include('contributors.name').get()

def = createQueryDef(db, QueryDefType.Root, { type: 'article' })

includeFields(def, ['contributors.name'])

buffer = addInclude(db, def)

debugQueryDef(def)

console.log(
  'old:',
  new Uint8Array(x.query.includeBuffer),
  'new:',
  new Uint8Array(Buffer.concat(buffer)),
)

console.log('-------------------------------------------------------------')

x = db.query('article').include('contributors').get()

def = createQueryDef(db, QueryDefType.Root, {
  type: 'article',
})

includeFields(def, ['contributors'])

buffer = addInclude(db, def)

debugQueryDef(def)

console.log(
  'old:',
  new Uint8Array(x.query.includeBuffer),
  'new:',
  new Uint8Array(Buffer.concat(buffer)),
)

console.log('-------------------------------------------------------------')

x = db
  .query('article2')
  .include('contributors.$role')
  .filter('name', '=', 'flap')
  .filter('burp', '=', 2)
  .filter('bla.name', '=', 'yurk')

  .get()

def = createQueryDef(db, QueryDefType.Root, {
  type: 'article2',
})

includeFields(def, ['contributors.$role'])

def.filter.size += filter(db, 'name', '=', 'flap', def.schema, def.filter)
def.filter.size += filter(db, 'burp', '=', 2, def.schema, def.filter)
def.filter.size += filter(db, 'bla.name', '=', 'yurk', def.schema, def.filter)

// eqv to BRANCH
const refDef = createQueryDef(db, QueryDefType.References, {
  type: 'user2',
  propDef: def.schema.props.contributors,
})

def.references.set(1, refDef)
refDef.filter.size += filter(
  db,
  'bla.name',
  '=',
  'flap',
  refDef.schema,
  refDef.filter,
)

buffer = addInclude(db, def)

// add all in 1 buffer also for the wire...

// debugQueryDef(def)
console.log('REF FILTER:', new Uint8Array(filterToBuffer(refDef.filter)))

console.log('FILTER:', new Uint8Array(filterToBuffer(def.filter)))
console.log('OLD FILTER:', new Uint8Array(x.query.filterTime))

console.log(
  'old:',
  new Uint8Array(x.query.includeBuffer),
  'new:',
  new Uint8Array(Buffer.concat(buffer)),
)

var dx = Date.now()

//   db.query('article').include('contributors.name').get()

var a, b

// for (let i = 0; i < 1e6; i++) {
//   // db.query('article').include('contributors.name').toBuffer()
//   def = createQueryDef(db, QueryDefType.Root, { type: 'article2' })
//   includeFields(def, [
//     'contributors.name',
//     'contributors.$role',
//     'name',
//     'burp',
//   ])
//   // includeFields(def, ['name', 'burp'])

//   buffer = addInclude(db, def)
//   a = Buffer.concat(buffer)

//   // debugQueryDef(def)
// }

// console.log('1m nested query defs', Date.now() - dx, 'ms')

// dx = Date.now()

// for (let i = 0; i < 1e6; i++) {
//   b = db
//     .query('article2')
//     // .include('name', 'burp')
//     .include('contributors.name', 'contributors.$role', 'name', 'burp')
//     .toBuffer().include

//   // debugQueryDef(def)
// }

// console.log('1m nested old query ', Date.now() - dx, 'ms')

// console.log(new Uint8Array(a), new Uint8Array(b))

const q = db.query('article2')
b = q
  // .include('name', 'burp')
  .include('contributors.name', 'contributors.$role', 'name', 'burp')
  .toBuffer().include

// console.log(q.includeDef.includeTree)
// --------------------------------------------------------------

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
