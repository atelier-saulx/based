import { BasedDb } from '../src/index.js'
import test from './shared/test.js'
import { deepEqual, equal } from './shared/assert.js'
import { euobserver } from './shared/examples.js'

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

  console.log(await db.drain())

  // console.log('BEFORE:', db.query('user').get().toObject())
  // remove field
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

  // console.log('AFTER2:', db.query('user').range(0, 1_000_000).get().toObject())
})
