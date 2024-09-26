import { BasedDb } from '../src/index.js'
import { setTimeout } from 'node:timers/promises'
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

  const user = db.create('user', {
    name: 'success',
  })

  // try {

  // throw new Error('fu')
  // } catch (e) {
  // console.error('ballz', e)
  // }

  // await setTimeout(500)
  // await setTimeout(500)
})
