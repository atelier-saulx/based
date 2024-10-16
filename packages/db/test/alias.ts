import { BasedDb } from '../src/index.js'
import test from './shared/test.js'

await test('alias', async (t) => {
  const db = new BasedDb({
    path: t.tmp,
  })

  await db.start({ clean: true })

  t.after(() => {
    return db.destroy()
  })

  db.putSchema({
    types: {
      user: {
        props: {
          externalId: 'alias',
        },
      },
    },
  })

  console.log(
    db.create('user', {
      externalId: 'cool',
    }),
  )

  // console.log(
  //   db.create('user', {
  //     isNice: false,
  //   }),
  // )

  db.drain()
})
