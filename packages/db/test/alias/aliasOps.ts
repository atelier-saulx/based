import { BasedDb } from '../../src/index.ts'
import test from '../shared/test.ts'
import { deepEqual, equal } from '../shared/assert.ts'

await test('upsert', async (t) => {
  const db = new BasedDb({
    path: t.tmp,
  })
  await db.start({ clean: true })
  t.after(() => t.backup(db))

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

await test('await updates', async (t) => {
  const db = new BasedDb({
    path: t.tmp,
  })
  await db.start({ clean: true })
  t.after(() => t.backup(db))

  const status = ['a', 'b', 'c', 'd', 'e', 'f']

  await db.setSchema({
    types: {
      user: {
        props: {
          externalId: { type: 'alias' },
          status,
        },
      },
    },
  })

  const total = 10e6

  for (let i = 0; i < total; i++) {
    db.create('user', {
      externalId: i + '-alias',
      status: 'a',
    })
  }

  await db.isModified()

  let totalAlias = 0

  const updateAlias = async () => {
    const externalId = Math.ceil(Math.random() * total) + '-alias'
    const id = Math.ceil(Math.random() * total)
    await db.update('user', id, {
      externalId,
    })
    totalAlias++
  }

  const start = performance.now()
  //let lastMeasure = performance.now()
  for (let i = 0; i < 100000; i++) {
    await updateAlias()
    if (!(i % 10000)) {
      //const opsPerS = totalAlias / ((performance.now() - lastMeasure) / 1e3)
      //console.log(`${~~opsPerS} per sec`)
      //lastMeasure = performance.now()
      totalAlias = 0
    }
  }

  equal(performance.now() - start < 5e3, true, 'should be smaller then 5s')
})
