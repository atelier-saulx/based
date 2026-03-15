import test from '../shared/test.js'
import { testDb } from '../shared/index.js'
import { deepEqual } from '../shared/assert.js'

await test.skip('basic sort by id', async (t) => {
  const db = await testDb(t, {
    types: {
      person: {
        props: {
          name: { type: 'string' },
          age: { type: 'uint32' },
        },
      },
    },
  })

  for (let i = 1; i <= 99; i++) {
    db.create('person', {
      name: `mr ${i}`,
      age: 18 + (i % 40),
    })
  }

  deepEqual(
    await db.query('person').include('name').order('desc').range(0, 5).get(),
    [
      {
        id: 99,
        name: 'mr 99',
      },
      {
        id: 98,
        name: 'mr 98',
      },
      {
        id: 97,
        name: 'mr 97',
      },
      {
        id: 96,
        name: 'mr 96',
      },
      {
        id: 95,
        name: 'mr 95',
      },
    ],
  )
})
