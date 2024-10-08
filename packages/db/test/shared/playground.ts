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
        flap: 'uint32',
        derp: 'boolean',
        ownedArticles: {
          items: {
            ref: 'article',
            prop: 'owner',
          },
        },
        favourite: {
          ref: 'article',
          prop: 'favouritedBy',
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
        burp: ['derp', 'flappie'],
        flap: 'uint32',
        published: 'boolean',
        favouritedBy: {
          items: {
            ref: 'user',
            prop: 'favourite',
          },
        },
        owner: {
          ref: 'user',
          prop: 'ownedArticles',
        },
        contributors: {
          type: 'references',
          items: {
            ref: 'user',
            prop: 'articles',
            $role: ['writer', 'editor'],
            $friend: { ref: 'user' },
          },
        },
      },
    },
  },
})

const user = await db.create('user', { flap: 1 })
db.drain()

const d = Date.now()

for (let i = 0; i < 5e6; i++) {
  db.create('todo', { done: false, age: i })
}

for (let i = 0; i < 1e6; i++) {
  db.create('user', {
    flap: ~~(Math.random() * 10),
    name: 'my flap ' + (i + 2) + '!',
  })
}

const ids: any = new Set()
const x = 2 // ~~(Math.random() * 1e3)
for (let j = 0; j < x; j++) {
  ids.add(~~(Math.random() * 1e6 - 1) + 1)
}
const y = [1, ...ids.values()].sort()

for (let i = 0; i < 10e3; i++) {
  db.create('article', {
    flap: (i % 2) * 10,
    name: 'Ultra article ' + i,
    published: !!(i % 2),
    burp: ['derp', 'flappie'][i % 2],
    owner: 1,
    favouritedBy: [1],
    // contributors: [{ id: 10, $friend: user }],
    contributors: y,
    // contributors: y.map((v) => {
    //   return { id: v, $friend: user }
    // }),
  })
}

console.log('db time', db.drain(), Date.now() - d)

// --------------------------------------------------------------
const def = q.createQueryDef(db, q.QueryDefType.Root, {
  type: 'article',
  // ids: new Uint32Array([1, 2]),
})
def.range.limit = 1000

const include = [
  'flap',
  'burp',
  'published',
  'name',
  // 'contributors.name',
  // 'contributors.flap',
  // 'contributors.derp',
  // 'contributors.ownedArticles.name',
  // 'contributors.favourite.name',
  // 'contributors.favourite.contributors.name',
  // 'owner.flap',
]
q.includeFields(def, include)

const refDef = q.createQueryDef(db, q.QueryDefType.References, {
  propDef: def.props.contributors,
  type: 'user',
})

refDef.range.offset = 1

refDef.range.limit = 2

q.sort(refDef, 'flap', 'desc')

q.includeFields(refDef, ['name', 'flap'])

def.references.set(def.props.contributors.prop, refDef)

def.range.limit = 3

// q.sort(def, 'flap', 'desc')
// q.filter(db, def, 'flap', '>', 2)
// q.filter(db, def, 'published', '=', true)

const b = Buffer.concat(q.defToBuffer(db, def))

q.debug(def)

q.debug(b)

console.log('RESULT')

const xxx = Date.now()

const result = db.native.getQueryBuf(b)
console.log(
  'getting result',
  Date.now() - xxx,
  'ms',
  Math.floor(result.byteLength / 1e3 / 1e3),
  'mb',
)

// q.debug(result)

const s = Date.now()
for (let i = 0; i < 1; i++) {
  q.resultToObject(def, result)
}
console.log(
  Date.now() - s,
  'ms',
  Math.floor(result.byteLength / 1e3 / 1e3),
  'mb',
)

console.dir(q.resultToObject(def, result), { depth: 10 })

// const xx = Date.now()
// const flap = db
//   .query('article')
//   .include(...include)
//   .get()
// for (let i = 0; i < 1; i++) {
//   flap.toObject()
// }
// console.log(
//   Date.now() - xx,
//   'ms',
//   Math.floor(flap.buffer.byteLength / 1e3 / 1e3),
//   'mb',
// )

// console.dir(q.resultToObject(def, result), { depth: 10 })

// console.log(JSON.stringify(q.resultToObject(def, result)))

// await fs.writeFile(
//   './tmp/flap.txt',
//   JSON.stringify(q.resultToObject(def, result)),
// )

// go make range work offset, limit
