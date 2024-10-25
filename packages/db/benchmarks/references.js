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
        articles: {
          items: {
            ref: 'writer',
            prop: 'articles',
          },
        },
      },
    },
  },
})

const articles = Array.from({ length: 10_000_000 }).map((_, i) => {
  return db.create('article', {
    body: 'cool body ' + i,
  })
})

db.drain()

db.create('writer', {
  articles,
})

perf('10e6 references drain', db.drain())
