import { wait } from '@saulx/utils'
import { homedir } from 'os'
import { fileURLToPath } from 'url'
import { BasedDb, compress } from '../../src/index.js'
import { join, dirname, resolve } from 'path'
import fs from 'node:fs/promises'
import oldFs from 'node:fs'
import { italy } from './examples.js'
import { pipeline } from 'node:stream/promises'
import { hash } from '@saulx/hash'
const italyWikipedia = compress(italy)

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

const runEuobserver = async (path: string) => {
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

  const db = new BasedDb({
    path,
  })

  await db.start({ clean: true })

  await db.putSchema({
    types: {
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

  var flap: string

  console.log(await db.query('bla').sort('x').get())

  const users = new Map()
  // @ts-ignore
  await pipeline(
    oldFs.createReadStream(join(homedir(), 'Downloads/dump.json'), 'utf-8'),
    async function* (source, { signal }) {
      source.setEncoding('utf-8')
      for await (const chunk of source) {
        yield await handleChunk(chunk, { signal })
      }
    },
  )
  await wait(100)
  console.log('Set euobserver data set (270mb)', await db.drain(), 'ms')

  await db
    .query('article')
    .range(0, 1e6)
    .filter('publishDate', '>', '01/01/2024')
    .sort('publishDate', 'desc')
    .get()
    .inspect(2)

  await db
    .query('article')
    .range(0, 100)
    .filter('publishDate', '>', '01/01/2024')
    .sort('publishDate', 'desc')
    .include('author', '*')
    .get()
    .inspect(2)

  const query = 'wilders'

  console.log('\nSEARCH FOR:', query)

  await db
    .query('article')
    .range(0, 10)
    .sort('publishDate', 'desc')
    .include('id', 'headline', 'publishDate', 'abstract')
    .search(query, {
      headline: 0,
      abstract: 1,
    })
    .get()
    .inspect(4)

  await db.destroy()
}

const runSimple = async (path: string) => {
  const db = new BasedDb({
    path,
  })
  await db.start({ clean: true, managed: false })

  const profession = ['developer', 'baker', '???']

  const name = 'Benedict Timothy Carlton Cumberbatch'

  await db.putSchema({
    types: {
      person: {
        props: {
          age: 'uint32',
          added: 'timestamp',
          profession,
          name: 'string',
        },
      },
    },
  })

  const amount = 1_000_000
  for (let i = 0; i < amount; i++) {
    db.create('person', {
      age: i,
      profession: profession[i % profession.length],
      name,
    })
  }

  console.log('Set ', amount, await db.drain(), 'ms')

  console.log(await db.query('person').range(0, 100_000).get())

  // await db.destroy()
}

await runSimple(dbFolder)
// await runEuobserver(dbFolder)
