import { BasedDb } from '../../src/index.ts'
import test from '../shared/test.ts'
import { isSorted } from '../shared/assert.ts'

await test('alias', async (t) => {
  const db = new BasedDb({ path: t.tmp })
  t.after(() => db.destroy())
  await db.start({ clean: true })
  await db.setSchema({
    types: {
      article: {
        props: {
          email: 'alias',
        },
      },
    },
  })

  for (let i = 0; i < 10; i++) {
    db.create('article', {
      email: i + ' create',
    })
  }

  await db.drain()

  isSorted(
    await db.query('article').sort('email', 'desc').get(),
    'email',
    'desc',
    'After create',
  )

  for (let i = 0; i < 10; i++) {
    const x = ~~(Math.random() * 5 + 1) + ' update'
    db.update('article', i + 1, {
      email: x,
    })
  }

  await db.drain()

  isSorted(
    await db.query('article').sort('email', 'desc').get(),
    'email',
    'desc',
    'After update',
  )

  for (let i = 0; i < 3; i++) {
    db.delete('article', i + 1)
  }

  await db.drain()

  isSorted(
    await db.query('article').sort('email', 'desc').get(),
    'email',
    'desc',
    'After delete',
  )

  for (let i = 0; i < 100; i++) {
    const x = ~~(Math.random() * 5 + 1) + ' update'
    db.create('article', {
      email: x,
    })
  }

  await db.drain()

  isSorted(
    await db.query('article').sort('email', 'desc').get(),
    'email',
    'desc',
    'After create (same values)',
  )
})
