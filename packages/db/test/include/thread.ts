import { BasedDb } from '../../src/index.js'
import test from '../shared/test.js'

await test('include', async (t) => {
  const db = new BasedDb({
    path: t.tmp,
  })
  await db.start({ clean: true })
  t.after(() => t.backup(db))

  await db.setSchema({
    types: {
      user: {
        props: {
          nr: 'uint32',
        },
      },
    },
  })

  const id = await db.create('user', {
    nr: 2,
  })

  db.query('user', id)

  console.log({ id })
})
