import { wait } from '@saulx/utils'
import { homedir } from 'os'
import { fileURLToPath } from 'url'
import { BasedDb } from '../../src/index.js'
import { join, dirname, resolve } from 'path'
import fs from 'node:fs/promises'
import oldFs from 'node:fs'
import { deflate } from 'node:zlib'
import util from 'util'
const deflap = util.promisify(deflate)
import { italy } from './examples.js'
import crypto from 'crypto'

function randU32() {
  return crypto.randomBytes(4).readUInt32LE(0)
}

import { pipeline } from 'node:stream/promises'
import { hash } from '@saulx/hash'

var prev: { start: number; chunk: string }[] = []

const indexOfSubstrings = function* (str, searchValue) {
  let i = 0
  while (true) {
    const r = str.indexOf(searchValue, i)
    if (r !== -1) {
      yield r
      i = r + 1
    } else return
  }
}

const __dirname = dirname(fileURLToPath(import.meta.url).replace('/dist/', '/'))
const relativePath = '../../tmp'
const dbFolder = resolve(join(__dirname, relativePath))

await wait(100)

try {
  await fs.rm(dbFolder, { recursive: true })
} catch (err) {}

// dbFolder

const makeDb = async (path: string) => {
  const db = new BasedDb({
    path,
    noCompression: true,
  })

  await db.start({ clean: true })

  console.log('\nJS GO DO BUT', Date.now(), path)

  db.putSchema({
    types: {
      bla: { props: { name: 'string', x: 'uint16', flap: 'binary' } },
      user: {
        props: {
          uid: 'string',
          firstName: 'string',
          lastName: 'string',
          articles: {
            items: {
              ref: 'article',
              prop: 'author',
            },
          },
        },
      },
      article: {
        props: {
          views: 'uint32',
          lastView: 'timestamp',
          headline: 'string',
          abstract: 'string',
          body: 'string',
          publishDate: 'timestamp',
          author: {
            ref: 'user',
            prop: 'articles',
          },
        },
      },
    },
  })

  await db.create('bla', {
    name: 'DERP ',
    x: 1,
  })

  var flap: string

  const users = new Map()

  const handleChunk = (chunk: string, x) => {
    if (flap) {
      chunk = flap + chunk
      flap = ''
    }
    const indexes = [...indexOfSubstrings(chunk, '{"id":')]
    for (let i = 0; i < indexes.length; i += 2) {
      if (!indexes[i + 1]) {
        flap = chunk.slice(indexes[i], -1)
      } else {
        try {
          var d = chunk.slice(indexes[i], indexes[i + 1] - 1)
          if (d[d.length - 1] == ']') {
            d = d.slice(0, -1)
          }
          const x = JSON.parse(d)
          const { id, author, ...r } = x
          // exclude in create is nice
          // const id = db.upsert('user', {
          const userId = hash(
            author.firstName.toLowerCase() +
              ':' +
              author.lastName.toLowerCase(),
          )
          if (!users.has(userId)) {
            users.set(
              userId,
              db.create('user', {
                uid: String(userId),
                firstName: author.firstName,
                lastName: author.lastName,
              }).tmpId,
            )
          }
          r.author = users.get(userId)
          db.create('article', r)
        } catch (err) {
          // console.log('derp', indexes[i], indexes[i + 1] - 1)
        }
      }
    }
  }

  // @ts-ignore
  await pipeline(
    oldFs.createReadStream(join(homedir(), 'Downloads/dump.json'), 'utf-8'),
    async function* (source, { signal }) {
      source.setEncoding('utf-8') // Work with strings rather than `Buffer`s.
      for await (const chunk of source) {
        yield await handleChunk(chunk, { signal })
      }
    },
  )

  console.log(db.query('bla').sort('x').get())

  console.log('YO', Date.now(), path)

  await wait(100)

  console.log('CLOSE', Date.now(), path)

  var d = Date.now()

  console.log('DRAIN BOI', Date.now() - d, 'ms', await db.drain(), 'ms')
  ;(
    await db
      .query('article')
      .range(0, 1e6)
      .filter('publishDate', '>', '01/01/2024')
      .sort('publishDate', 'desc')
      .get()
  ).inspect(2)
  ;(
    await db
      .query('article')
      .range(0, 100)
      .filter('publishDate', '>', '01/01/2024')
      .sort('publishDate', 'desc')
      .include('author', '*')
      .get()
  )
    // .debug()
    .inspect(2)

  // .debug()

  // STRINGS
  // console.log(
  //   db.query('user').filter('firstName', '=', 'Elena Sánchez').get().node().id,
  // )
  ;(
    await db
      .query('article')
      .range(0, 1e6)
      // .filter('author', '=', 25)
      .sort('publishDate', 'desc')
      .include('author', '*')
      .get()
  )
    // .debug()
    .inspect(2)

  // handle this in search split and make a loop
  // const query = 'german rebuke'

  // maybe levensthein

  // const query = 'orban'
  const query = 'vaca'

  console.log('\nSEARCH FOR:', query)
  await db
    .query('article')
    .range(0, 10)
    .sort('publishDate', 'desc')
    .include(['id', 'headline', 'publishDate', 'abstract'])
    .search(query, { headline: 0, abstract: 2, body: 5 })
    .get()
    .then((v) => {
      // console.dir(v.toObject(), { depth: 10 })
      v.inspect(2)
    })

  const start = performance.now()
  await db.stop(false)
  const end = performance.now()
  console.log('save took: ', end - start)
}

const makeDb1 = async (path: string) => {
  const db = new BasedDb({
    path,
    // noCompression: true,
  })

  await db.start({ clean: true })

  console.log('\nJS GO DO BUT', Date.now(), path)

  db.putSchema({
    types: {
      financeBoi: {
        props: {
          x1: { type: 'uint32' },
          x2: { type: 'uint32' },
          x3: { type: 'uint32' },
          x4: { type: 'uint32' },
          x5: { type: 'uint32' },
          x6: { type: 'uint32' },
        },
      },
    },
  })

  for (let i = 0; i < 50_000_000; i++) {
    db.create('financeBoi', {
      x1: i,
      x2: i,
      x3: i,
      x4: i,
      x5: i,
      x6: i,
    })
  }
  const res = await db.drain()
  console.error('created all nodes', res)

  const start = performance.now()
  await db.stop(false)
  const end = performance.now()
  console.log('save took: ', end - start)
}

await makeDb(dbFolder + '/1')

// await makeDb(dbFolder + '/1')

// await makeDb1(dbFolder + '/2')

// await Promise.all([makeDb(dbFolder + '/1'), makeDb(dbFolder + '/2')])

// const f = await fs.writeFile(dbFolder + '/file.txt', '')

// const d = Date.now()
// let bla = []
// const file = oldFs.openSync(dbFolder + '/file.txt', null)
// let b = 0
// for (let i = 0; i < 10e6; i++) {
//   bla.push({
//     name: 'bla',
//     user: 'snur@gmail.com',
//     derp: 'derp derp',
//     i,
//   })
//   b++
//   if (b === 10e3) {
//     await fs.appendFile(
//       dbFolder + '/file.txt',
//       await deflap(Buffer.from(JSON.stringify(bla), 'utf-8')),
//     )
//     b = 0
//     bla = []
//   }
// }

// console.log('DONE', Date.now() - d, 'ms')
