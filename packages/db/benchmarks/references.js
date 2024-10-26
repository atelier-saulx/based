import { BasedDb } from '@based/db'
import { tmpdir } from 'os'
import { perf } from './utils.js'

const db = new BasedDb({
  path: tmpdir(),
})

await db.start({ clean: true })

db.putSchema({
  types: {
    article: {
      props: {
        body: 'string',
        writer: {
          ref: 'writer',
          prop: 'articles',
        },
      },
    },
    writer: {
      props: {
        name: 'string',
        articles: {
          items: {
            ref: 'article',
            prop: 'writer',
          },
        },
      },
    },
  },
})

const articles = Array.from({ length: 2 }).map((_, i) => {
  return db.create('article', {
    body: 'cool body ' + i,
  })
})

const writer = db.create('writer', {
  name: 'youzi',
  articles,
})

db.drain()

// perf('1e7 references drain', db.drain())

// db.update('writer', writer, {
//   articles: [articles[0]],
// })

// perf('1e7 references update drain', db.drain())

console.log(
  '----',
  db.query('writer').include('*', 'articles').get().toObject(),
)
