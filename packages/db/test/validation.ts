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

  try {
    const user = await db.create('user', {
      name: 'success',
    })

    console.log('!!!', user)
  } catch (e) {
    console.error('ERR:', e)
  }
})
