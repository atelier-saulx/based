import { BasedDb } from '../src/index.js'
import test from './shared/test.js'
import { deepEqual } from './shared/assert.js'

await test('multiple', async (t) => {
  const db = new BasedDb({
    path: t.tmp,
  })

  t.after(() => {
    return db.destroy()
  })

  await db.start({ clean: true })

  await db.putSchema({
    types: {
      user: {
        props: {
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
            type: 'references',
            items: {
              ref: 'user',
              prop: 'articles',
              $rating: 'uint32',
              $rdy: 'boolean',
            },
          },
        },
      },
    },
  })

  const mrDerp = await db.create('user', { name: 'mr Derp' })

  const fantasticalFriday = await db.create('article', {
    name: 'Fantastical Friday',
    contributors: [
      {
        id: mrDerp,
        $rating: 1,
      },
    ],
  })

  await db
    .query('article')
    .include('contributors.$rating')
    // .include('*', 'contributors.$rating', 'contributors.*')
    .get()
    .inspect()
    .then((v) => v.debug())
})
