import { BasedDb } from '../src/index.js'
import { deepEqual } from './shared/assert.js'
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

  const derulo = {
    name: 'jason',
    myJson: {
      bllz: {
        to: {
          the: 'wallz',
        },
      },
    },
  }

  await db.create('jsonDerulo', derulo)

  deepEqual(await db.query('jsonDerulo').get().toObject(), [
    {
      id: 1,
      ...derulo,
    },
  ])
})
