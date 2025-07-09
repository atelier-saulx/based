import { wait } from '@saulx/utils'
import { BasedDb } from '../src/index.js'
import { deepEqual, equal } from './shared/assert.js'
import test from './shared/test.js'

await test('timestamp', async (t) => {
  const db = new BasedDb({
    path: t.tmp,
  })

  await db.start({ clean: true })

  t.after(() => t.backup(db))

  await db.setSchema({
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
          mrDerp: 'timestamp',
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

  await wait(10)
  await db.update('user', youzi, {
    name: 'youzi1',
  })

  res = (await db.query('user').get()).toObject()

  if (!(res[0].updatedAt > res[0].createdAt)) {
    throw 'updatedAt should be updated after update'
  }

  const measure = async (v: number) => {
    deepEqual(
      Math.floor((await db.query('user', youzi).get().toObject()).mrDerp / 10),
      Math.floor(v / 10),
    )
  }

  await db.update('user', youzi, {
    name: 'youzi1',
    mrDerp: 'now + 1h',
  })

  await measure(Date.now() + 60 * 1e3 * 60)

  await db.update('user', youzi, {
    name: 'youzi1',
    mrDerp: 'now + 1m',
  })

  await measure(Date.now() + 60 * 1e3)

  await db.update('user', youzi, {
    name: 'youzi1',
    mrDerp: '01/02/2020',
  })

  await measure(new Date('01/02/2020').valueOf())

  const overwriteCreatedAt = Date.now()
  const overwriteUpdatedAt = Date.now() + 10

  const jamex = await db.create('user', {
    createdAt: overwriteCreatedAt,
    updatedAt: overwriteUpdatedAt,
  })

  await db.update('user', youzi, {
    createdAt: overwriteCreatedAt,
    updatedAt: overwriteUpdatedAt,
  })

  const newUser = await db.query('user', jamex).get().toObject()
  const updatedUser = await db.query('user', youzi).get().toObject()

  equal(newUser.createdAt, overwriteCreatedAt)
  equal(newUser.updatedAt, overwriteUpdatedAt)
  equal(updatedUser.createdAt, overwriteCreatedAt)
  equal(updatedUser.updatedAt, overwriteUpdatedAt)
})
