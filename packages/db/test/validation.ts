import { BasedDb } from '../src/index.js'
import test from './shared/test.js'

await test('update', async (t) => {
  const db = new BasedDb({
    path: t.tmp,
  })

  await db.start({ clean: true })

  t.after(() => db.destroy())

  db.updateSchema({
    types: {
      user: {
        props: {
          name: { type: 'string' },
        },
      },
    },
  })

  let bad

  const youzi = db.create('user', {
    name: 'youzi',
  })

  // try {
  bad = db.create('user', {
    name: 1,
  })

  const jamex = db.create('user', {
    name: 'jamex',
  })

  console.log({ youzi, jamex })

  //   throw 'Should throw'
  // } catch (e) {
  //   console.log('ERROR!!', e)
  // }
})
