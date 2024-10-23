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

  db.drain()

  const res = db.query('user', user).get()

  console.log({ res })
})
