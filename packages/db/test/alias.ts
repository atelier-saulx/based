import { BasedDb } from '../src/index.js'
import test from './shared/test.js'
import { setTimeout } from 'node:timers/promises'

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

  await setTimeout(1e3)
  const user = db.create('user', {
    externalId: 'cool',
  })
  console.log({ user })

  // console.log(
  //   db.create('user', {
  //     isNice: false,
  //   }),
  // )

  db.drain()
  console.log('EVERYTHING IS FINE')
  await setTimeout(1e3)
  console.log(
    db.update('user', user, {
      externalId: 'ballz',
    }),
  )
  db.drain()
})
