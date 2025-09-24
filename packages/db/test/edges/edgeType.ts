import { BasedDb } from '../../src/index.js'
import test from '../shared/test.js'
import { deepEqual } from '../shared/assert.js'

await test('single reference', async (t) => {
  const db = new BasedDb({
    path: t.tmp,
  })

  await db.start({ clean: true })
  t.after(() => t.backup(db))
  await db.setSchema({
    types: {
      user: {
        props: {
          name: 'string',
          derp: 'uint8',
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
          name: 'string',
          author: {
            type: 'reference',
            ref: 'user',
            prop: 'articles',
            $note: { type: 'string', maxBytes: 20 },
          },
        },
      },
    },
  })

  const mr = await Promise.all([
    db.create('user', { name: 'Mr Drol', }),
    db.create('user', { name: 'Mr Derp', }),
  ])

  await db.create('article', {
    name: 'The wonders of Strudel',
    author: {
      id: mr[0],
      $note: 'funny',
    },
  })

  //console.log(db.server.schemaTypesParsed)
  await db.query('article').include('*', '**').get().inspect()
  await db.query('_article:author').include('*').get().inspect()
  deepEqual([...db.server.verifTree.types()].map((type) => type.typeId), [2, 3, 4])
  deepEqual(db.server.dirtyRanges.size, 3)
})
