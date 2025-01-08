import { BasedDb } from '../src/index.js'
import test from './shared/test.js'
import { deepEqual, equal } from './shared/assert.js'
import { text } from './shared/examples.js'

await test('compressed', async (t) => {
  const db = new BasedDb({
    path: t.tmp,
  })

  await db.start({ clean: true })

  t.after(() => {
    return db.destroy()
  })

  db.putSchema({
    types: {
      article: {
        props: {
          name: { type: 'string' },
          article: { type: 'string' },
        },
      },
    },
  })

  for (let i = 0; i < 10e3; i++) {
    db.create('article', {
      name: 'Article ' + i,
      article: i + 'derp ' + text,
    })
  }

  const dbTime = db.drain()
  console.log('db modify + compress', dbTime, 'ms')
  equal(dbTime < 1000, true, 'db modify should not take longer then 1s')

  let d = Date.now()
  db.server.createSortIndex('article', 'article')
  let siTime = Date.now() - d
  console.log('create sort index (string)', siTime, 'ms')
  equal(
    siTime < 500,
    true,
    'creating string sort index should not take longer then 500ms',
  )

  const r = await db
    .query('article')
    .include('name', 'article')
    .range(0, 10)
    .sort('article')
    .get()
    .then((v) => v.inspect())
})
