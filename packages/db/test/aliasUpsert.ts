import { BasedDb } from '../src/index.js'
import test from './shared/test.js'
import { deepEqual, equal } from './shared/assert.js'

await test('upsert', async (t) => {
  const db = new BasedDb({
    path: t.tmp,
  })

  await db.start({ clean: true })

  t.after(() => {
    return t.backup(db)
  })

  await db.setSchema({
    types: {
      user: {
        props: {
          externalId: 'alias',
          status: ['a', 'b'],
        },
      },
    },
  })

  const user1 = await db.create('user', {
    externalId: 'cool',
    status: 'a',
  })

  deepEqual(await db.query('user', user1).get(), {
    id: 1,
    status: 'a',
    externalId: 'cool',
  })

  await db.update('user', user1, {
    externalId: null,
    status: 'b',
  })

  deepEqual(await db.query('user', user1).get(), {
    id: 1,
    status: 'b',
    externalId: '',
  })
})

await test('updates', async (t) => {
  const db = new BasedDb({
    path: t.tmp,
  })

  await db.start({ clean: true })

  t.after(() => {
    return t.backup(db)
  })

  const status = ['a', 'b', 'c', 'd', 'e', 'f']

  await db.setSchema({
    types: {
      user: {
        props: {
          externalId: { type: 'string', max: 20 },
          status,
        },
      },
    },
  })

  const total = 1e4

  var d = Date.now()

  for (let i = 0; i < total; i++) {
    db.create('user', {
      externalId: i + '-alias',
      status: 'a',
    })
  }

  await db.isModified()
  console.log('done setting', total, 'aliases', Date.now() - d, 'ms')

  let totalAlias = 0

  const updateAlias = async () => {
    const id = Math.ceil(Math.random() * total)
    db.update('user', id, {
      status: status[~~Math.random() * status.length],
    })
    await db.drain()
    totalAlias++
  }

  const start = Date.now()
  let lastMeasure = Date.now()
  for (let i = 0; i < 100000; i++) {
    await updateAlias()
    if (!(i % 500)) {
      const opsPerS = totalAlias / ((Date.now() - lastMeasure) / 1e3)
      console.log(`${~~opsPerS} per sec`)
      lastMeasure = Date.now()
      totalAlias = 0
    }
  }

  equal(Date.now() - start < 3e3, true, 'should be smaller then 5s')
})
