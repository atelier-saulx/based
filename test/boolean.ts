import { BasedDb } from '../src/index.js'
import test from './shared/test.js'
import { deepEqual } from './shared/assert.js'

await test('boolean', async (t) => {
  const db = new BasedDb({
    path: t.tmp,
  })
  await db.start({ clean: true })
  t.after(() => t.backup(db))

  const client = await db.setSchema({
    types: {
      user: {
        props: {
          isNice: 'boolean',
        },
      },
    },
  })

  await client.create('user', {})

  await client.create('user', {
    isNice: true,
  })

  await client.create('user', {
    isNice: false,
  })

  await client.drain()

  deepEqual(await client.query('user').get(), [
    { id: 1, isNice: false },
    { id: 2, isNice: true },
    { id: 3, isNice: false },
  ])

  deepEqual(await client.query('user').filter('isNice', '=', true).get(), [
    { id: 2, isNice: true },
  ])

  deepEqual(await client.query('user').filter('isNice').get(), [
    { id: 2, isNice: true },
  ])

  deepEqual(await client.query('user').filter('isNice', '=', false).get(), [
    { id: 1, isNice: false },
    { id: 3, isNice: false },
  ])
})
