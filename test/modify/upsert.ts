import { testDb } from '../shared/index.js'
import test from '../shared/test.js'

await test.skip('upsert', async (t) => {
  const db = await testDb(t, {
    types: {
      user: {
        email: 'alias',
        uuid: 'alias',
        isNice: 'boolean',
      },
    },
  })

  // this is allowed
  const youzi = db.upsert(
    'user',
    { uuid: '9dg786' }, // target by alias
    { email: 'youri@saulx.com', isNice: true },
  )

  //   // this is not
  //   const youzi2 = db.upsert(
  //     'user',
  //     { isNice: true }, // has to be type alias!
  //     { email: 'youri@saulx.com', isNice: true },
  //   )

  console.dir(await db.query('user').get())
})
