import { BasedDb } from '../../src/index.ts'
import test from '../shared/test.ts'
import { deepEqual, equal } from '../shared/assert.ts'

await test('sort Enum', async (t) => {
  const db = new BasedDb({
    path: t.tmp,
  })

  await db.start({ clean: true })

  t.after(() => {
    return t.backup(db)
  })

  const status = ['a', 'b', 'c', 'd', 'e', 'f']
  await db.setSchema({
    types: {
      user: {
        props: {
          status,
        },
      },
    },
  })

  for (let i = 0; i < 3e6; i++) {
    db.create('user', {
      status: status[i % 6],
    })
  }

  const dbTime = await db.drain()

  const randoIds = []
  for (let i = 0; i < 100; i++) {
    randoIds.push(~~(Math.random() * 3e6) + 1)
  }

  const q = []
  for (let i = 0; i < 500; i++) {
    q.push(db.query('user', randoIds).get())
  }

  q.push(
    db.query('user').filter('status', '=', ['a', 'b', 'c']).range(0, 950).get(),
  )

  q.push(
    db.query('user').filter('status', '=', ['d']).range(0, 600).get(),
    // .inspect(1000),
  )

  const d = Date.now()
  await Promise.all(q)
  console.log(Date.now() - d, 'ms', 'exec 500 times')

  // let d = Date.now()
  // let siTime = Date.now() - d
  // equal(
  //   siTime < 500,
  //   true,
  //   'creating string sort index should not take longer then 500ms',
  // )

  // const r = await db.query('user').range(0, 1e5).sort('status').get()
  // filter
})
