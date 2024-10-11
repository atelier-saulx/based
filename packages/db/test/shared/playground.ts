import { wait } from '@saulx/utils'
import { fileURLToPath } from 'url'
import { BasedDb } from '../../src/index.js'
import { join, dirname, resolve } from 'path'
import fs from 'node:fs/promises'
import * as q from '../../src/query/toBuffer.js'
import { text, italy, euobserver } from './examples.js'

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

await db.create('user', { flap: 1, name: 'derp' })
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
const x = 2
for (let j = 0; j < x; j++) {
  ids.add(~~(Math.random() * 1e6 - 1) + 1)
}
const y = [1, ...ids.values()].sort().map((v) => {
  return {
    id: v,
    $role: 'writer',
  }
})

for (let i = 0; i < 10e3; i++) {
  db.create('article', {
    flap: (i % 2) * 10,
    name: 'Ultra article ' + i,
    published: !!(i % 2),
    burp: ['derp', 'flappie'][i % 2],
    owner: 1,
    favouritedBy: [1],
    contributors: y,
  })
}

console.log('db time', db.drain(), Date.now() - d)

const r = db
  .query('article')
  .include((s) => {
    s('contributors')
      .filter('name', '=', 'derp')
      .include('name', '$role', (s) => {
        s('favourite').include('*')
      })
  })
  .range(10, 3)
  .get()

r.debug()

console.dir(r.toObject(), { depth: 10 })

console.log(r)

var yy = Date.now()

// 'contributors',
// .include('name', 'flap', 'burp')
for (let i = 0; i < 1e6; i++) {
  // allow arrays
  q.defToBuffer(db, db.query('article').include('contributors', 'flap').def)
}
console.log(Date.now() - yy, 'ms')
