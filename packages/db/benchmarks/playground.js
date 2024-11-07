import { BasedDb } from '@based/db'
import { tmpdir } from 'os'
import { setTimeout } from 'node:timers/promises'

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
