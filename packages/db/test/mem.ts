import { BasedDb } from '../src/index.js'
import test from './shared/test.js'
import { deepEqual } from './shared/assert.js'
import { equal } from 'assert'

await test('mem', async (t) => {
  const db = new BasedDb({
    path: t.tmp,
  })

  await db.start({ clean: true })

  t.after(() => {
    return db.destroy()
  })

  db.putSchema({
    types: {
      data: {
        props: {
          age: { type: 'uint32' },
          name: { type: 'string' },
        },
      },
    },
  })

  const amount = 1e3
  const repeat = 2e3
  // 2M inserts rmeoves

  for (let j = 0; j < repeat; j++) {
    // To keep many different blocks
    await db.create('data', {
      age: 666,
      name: 'BASIC ' + j,
    })

    const ids = []
    for (let i = 0; i < amount; i++) {
      ids.push(
        db.create('data', {
          age: i,
          name: 'mr flap flap',
        }).tmpId,
      )
    }

    await db.drain()

    for (let i = 0; i < amount; i++) {
      db.delete('data', ids[i])
    }

    await db.drain()

    equal((await db.query('data').range(0, 10e6).get()).length, j + 1)

    console.log(`Ran ${j + 1} / ${repeat}`)
  }
})
