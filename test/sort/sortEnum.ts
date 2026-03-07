import test from '../shared/test.js'
import { testDb } from '../shared/index.js'

await test('sort Enum', async (t) => {
  const status = ['a', 'b', 'c', 'd', 'e', 'f']
  const db = await testDb(t, {
    types: {
      user: {
        props: {
          status,
        },
      },
    },
  })

  const n = 3e4 //6
  for (let i = 0; i < n; i++) {
    db.create('user', {
      status: status[i % 6],
    })
  }

  const randoIds: any[] = []
  for (let i = 0; i < 100; i++) {
    randoIds.push(~~(Math.random() * n) + 1)
  }

  const q: any[] = []
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
