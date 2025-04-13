import { BasedDb } from '../src/index.js'
import { deepEqual } from './shared/assert.js'
import test from './shared/test.js'

await test('json', async (t) => {
  const db = new BasedDb({
    path: t.tmp,
  })

  await db.start({ clean: true })

  t.after(() => {
    return t.backup(db)
  })

  await db.setSchema({
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

  deepEqual(
    await db.query('jsonDerulo').get(),
    [
      {
        id: 1,
        ...derulo,
      },
    ],
    'simple',
  )

  const jay = await db.create('jsonDerulo', {
    myJson: {},
  })

  deepEqual(
    await db.query('jsonDerulo').get(),
    [
      { id: 1, ...derulo },
      { id: 2, myJson: {}, name: '' },
    ],
    'after empty object',
  )

  await db.update('jsonDerulo', {
    id: jay,
    myJson: null,
  })

  deepEqual(
    await db.query('jsonDerulo').get(),
    [
      { id: 1, ...derulo },
      { id: 2, myJson: null, name: '' },
    ],
    'json null',
  )
})
