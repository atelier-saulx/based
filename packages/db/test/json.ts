import { BasedDb } from '../src/index.js'
import test from './shared/test.js'

await test('json', async (t) => {
  const db = new BasedDb({
    path: t.tmp,
  })

  await db.start({ clean: true })

  t.after(() => {
    return db.destroy()
  })

  await db.putSchema({
    types: {
      jsonDerulo: {
        name: 'string',
        myJson: 'json',
      },
    },
  })

  const jsonDerulo = await db.create('jsonDerulo', {
    myJson: {
      bllz: {
        to: {
          the: 'wallz',
        },
      },
    },
  })

  await db.drain()

  console.log(await db.query('jsonDerulo').get().toObject())
})
