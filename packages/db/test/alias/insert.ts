import { BasedDb } from '../../src/index.js'
import { equal } from '../shared/assert.js'
import test from '../shared/test.js'

await test('alias insert', async (t) => {
  const db = new BasedDb({
    path: t.tmp,
  })

  await db.start({ clean: true })

  t.after(() => t.backup(db))

  await db.setSchema({
    types: {
      user: {
        props: {
          uuid: 'alias',
          one: 'number',
          two: 'number',
        },
      },
    },
  })

  await db.insert('user', {
    uuid: 'xx',
    one: 1,
    two: 2,
  })

  equal(await db.query('user').get(), [
    {
      id: 1,
      uuid: 'xx',
      one: 1,
      two: 2,
    },
  ])

  await db.insert('user', {
    uuid: 'xx',
    one: 5,
    two: 6,
  })

  equal(await db.query('user').get(), [
    {
      id: 1,
      uuid: 'xx',
      one: 1,
      two: 2,
    },
  ])

  await db.insert('user', {
    uuid: 'yy',
    one: 5,
    two: 6,
  })

  equal(await db.query('user').get(), [
    {
      id: 1,
      uuid: 'xx',
      one: 1,
      two: 2,
    },
    {
      id: 2,
      uuid: 'yy',
      one: 5,
      two: 6,
    },
  ])
})
