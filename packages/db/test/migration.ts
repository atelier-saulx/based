import { BasedDb } from '../src/index.js'
import test from './shared/test.js'
import { deepEqual, equal } from './shared/assert.js'
import { euobserver } from './shared/examples.js'
import { setTimeout } from 'node:timers/promises'
await test('migration', async (t) => {
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
          name: { type: 'string' },
        },
      },
    },
  })

  let i = 5_000_000
  while (i--) {
    db.create('user', {
      name: 'user ' + i,
    })
  }

  await db.migrateSchema(
    {
      types: {
        user: {
          props: {
            email: { type: 'string' },
          },
        },
      },
    },
    (type, node) => {
      if (type === 'user') {
        node.email = node.name.replace(/ /g, '-') + '@gmail.com'
        return node
      }
    },
  )
})
