import { BasedDb } from '../src/index.js'
import test from './shared/test.js'

await test('timestamp', async (t) => {
  const db = new BasedDb({
    path: t.tmp,
  })

  await db.start({ clean: true })

  t.after(() => {
    return db.destroy()
  })

  await db.putSchema({
    types: {
      user: {
        props: {
          name: 'string',
          createdAt: {
            type: 'timestamp',
            on: 'create',
          },
          updatedAt: {
            type: 'timestamp',
            on: 'update',
          },
        },
      },
    },
  })

  const now = Date.now()
  const youzi = await db.create('user', {
    name: 'youzi',
  })

  let res = (await db.query('user').get()).toObject()

  if (typeof res[0].createdAt !== 'number') {
    throw 'should be number'
  }

  if (res[0].createdAt < now) {
    throw 'should be Date.now()'
  }

  if (res[0].createdAt !== res[0].updatedAt) {
    throw 'createdAt should equal updatedAt after creation'
  }

  await db.update('user', youzi, {
    name: 'youzi1',
  })

  res = (await db.query('user').get()).toObject()

  if (!(res[0].updatedAt > res[0].createdAt)) {
    throw 'updatedAt should be updated after update'
  }
})
