import { BasedDb } from '../src/index.js'
import test from './shared/test.js'

await test('too large payload should throw, correct size should not', async (t) => {
  const db = new BasedDb({
    path: t.tmp,
    maxModifySize: 80,
  })
  await db.start({ clean: true })
  t.after(() => t.backup(db))

  await db.setSchema({
    types: {
      user: {
        props: {
          name: 'string',
        },
      },
    },
  })

  let error
  try {
    db.create('user', {
      name: 'cool string but too long for the max size unfortunately wow what the hell',
    })
  } catch (e) {
    error = e
  }

  if (error) {
    console.info('expected error: ', error.toString())
  } else {
    throw new Error('Too large payload should throw!')
  }

  let i = 10
  while (i--) {
    db.create('user', {
      name: 'user' + i,
    })
  }

  await db.drain()
})
