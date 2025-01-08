import { BasedDb } from '../src/index.js'
import test from './shared/test.js'
import { deepEqual, equal } from './shared/assert.js'
import { text } from './shared/examples.js'
import { randomString } from '@saulx/utils'

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
          article: { type: 'string', compression: 'none' },
          nr: { type: 'uint32' },
        },
      },
    },
  })

  const results: { id: number; nr: number; article: string; name: string }[] =
    []

  const len = 5

  for (let i = 0; i < len; i++) {
    const n = ~~(Math.random() * 9)
    const article = n + randomString(10, { noSpecials: true })
    const p: any = {
      name: 'Article ' + n,
      article: article,
      nr: n,
    }
    p.id = Number(db.create('article', p))
    results.push(p)
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
    .include('name', 'article', 'nr')
    .range(0, 10)
    .sort('article')
    .get()
    .then((v) => v.inspect(10))

  deepEqual(
    r.toObject(),
    results.sort((a, b) => a.nr - b.nr),
  )
})
