import { wait } from '../src/utils/index.js'
import { deepEqual, equal } from './shared/assert.js'
import test from './shared/test.js'
import { testDb } from './shared/index.js'

await test('timestamp', async (t) => {
  const db = await testDb(t, {
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

  let res = await db.query('user').get()

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

  res = await db.query('user').get()

  if (!(res[0].updatedAt > res[0].createdAt)) {
    throw 'updatedAt should be updated after update'
  }

  const measure = async (v: number) => {
    deepEqual(
      Math.floor(((await db.query('user', youzi).get())?.mrDerp ?? 0) / 10),
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

  const newUser = await db.query('user', jamex).get()
  const updatedUser = await db.query('user', youzi).get()

  equal(newUser?.createdAt, overwriteCreatedAt)
  equal(newUser?.updatedAt, overwriteUpdatedAt)
  equal(updatedUser?.createdAt, overwriteCreatedAt)
  equal(updatedUser?.updatedAt, overwriteUpdatedAt)
})

await test('timestamp before 1970', async (t) => {
  const db = await testDb(t, {
    types: {
      user: {
        props: {
          name: 'string',
          bday: 'timestamp',
        },
      },
    },
  })

  const d = new Date('01/02/1900')

  const user = await db.create('user', {
    bday: d,
  })

  const res = await db.query('user', user).get()
  equal(res?.bday, d.valueOf())
})
