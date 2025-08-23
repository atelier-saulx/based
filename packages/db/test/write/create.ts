import test from '../shared/test.js'
import { BasedDb } from '../../src/index.js'
import { create } from '../../src/client/write/create.js'
import { Ctx } from '../../src/client/write/Ctx.js'
import { drain } from '../../src/client/write/drain.js'

test('better create', async (t) => {
  const db = new BasedDb({
    path: t.tmp,
  })

  await db.start({ clean: true })

  t.after(() => t.backup(db))

  await db.setSchema({
    types: {
      user: {
        age: 'number',
      },
    },
  })

  const ctx = new Ctx(new Uint8Array(100))

  create(ctx, db.client.schemaTypesParsed.user, {
    age: 10,
  })

  await drain(db.client, ctx)

  console.log('here:', await db.query('user').get())

  // const res = db.create('user', {
  //   name: 'youri',
  //   email: 'power@magic.nl',
  // })

  // await db.drain()
  // const res2 = db.create('user', {
  //   friend: res,
  // })
})
