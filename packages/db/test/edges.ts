import { BasedDb } from '../src/index.js'
import test from './shared/test.js'
import { deepEqual } from './shared/assert.js'

await test('simple', async (t) => {
  const db = new BasedDb({
    path: t.tmp,
  })

  t.after(() => {
    return db.destroy()
  })

  await db.start({ clean: true })

  db.updateSchema({
    types: {
      user: {
        props: {
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
          contributors: {
            items: {
              $role: ['writer', 'editor'],
              ref: 'user',
              prop: 'articles',
            },
          },
        },
      },
    },
  })

  const mrSnurp = db.create('user', {
    name: 'Mr snurp',
    flap: 10,
  })

  // const flippie = db.create('user', {
  //   name: 'Flippie',
  //   flap: 20,
  // })

  db.drain()

  const strudelArticle = db.create('article', {
    name: 'The wonders of Strudel',
    contributors: [{ id: mrSnurp, $role: 'writer' }],
  })

  // const piArticle = db.create('article', {
  //   name: 'Apple Pie is a Lie',
  //   contributors: [mrSnurp, flippie],
  // })

  db.drain()

  console.info(db.query('articles').include('contributors.$role').get())

  // deepEqual(db.query('user').include('articles.name').get().toObject(), [
  //   {
  //     id: 1,
  //     articles: [
  //       { id: 1, name: 'The wonders of Strudel' },
  //       { id: 2, name: 'Apple Pie is a Lie' },
  //     ],
  //   },
  //   { id: 2, articles: [{ id: 2, name: 'Apple Pie is a Lie' }] },
  // ])
})
