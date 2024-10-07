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
        burp: [1, 2],
        flap: 'uint32',
        published: 'boolean',
        favouritedBy: {
          items: {
            ref: 'user',
            prop: 'favourite',
          },
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

for (let i = 0; i < 20e6; i++) {
  db.create('todo', { done: false, age: i })
}

for (let i = 0; i < 1e6; i++) {
  db.create('user', { flap: i })
}

const ids: any = new Set()
const x = 100 // ~~(Math.random() * 1e3)
for (let j = 0; j < x; j++) {
  ids.add(~~(Math.random() * 1e6 - 1) + 1)
}
const y = [...ids.values()].sort()

for (let i = 0; i < 1e3; i++) {
  db.create('article', {
    name: 'Ultra article ' + i,
    published: !!(i % 2),
    // contributors: [{ id: 10, $friend: user }],
    // contributors: y,
    // contributors: y.map((v) => {
    //   return { id: v, $friend: user }
    // }),
  })
}

console.log('db time', db.drain(), Date.now() - d)

// --------------------------------------------------------------
const def = q.createQueryDef(db, q.QueryDefType.Root, {
  type: 'article',
  ids: new Uint32Array([1, 2]),
})
def.range.limit = 1000
q.includeFields(def, ['contributors.name'])

q.sort(def, 'flap', 'desc')
q.filter(db, def, 'flap', '>', 2)
q.filter(db, def, 'published', '=', true)

const b = Buffer.concat(q.defToBuffer(db, def))

console.log(b.toString('base64'))

console.log(q.debug(b))

console.log('RESULT')
db.native.getQueryBuf(b)
