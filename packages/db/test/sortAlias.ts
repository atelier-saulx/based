import { BasedDb } from '../src/index.js'
import test from './shared/test.js'
import { isSorted } from './shared/assert.js'

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
      email: i + ' flap',
    })
  }

  await db.drain()

  isSorted(
    await db.query('article').sort('email', 'desc').get(),
    'email',
    'desc',
  )

  for (let i = 0; i < 10; i++) {
    db.update('article', i + 1, {
      email: ~~(Math.random() * 100) + ' flap',
    })
  }

  await db.drain()

  isSorted(
    await db.query('article').sort('email', 'desc').get(),
    'email',
    'desc',
  )

  for (let i = 0; i < 3; i++) {
    db.delete('article', i + 1)
  }

  await db.drain()

  isSorted(
    await db.query('article').sort('email', 'desc').get(),
    'email',
    'desc',
  )
})
