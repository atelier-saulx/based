import { BasedDb } from '../src/index.js'
import test from './shared/test.js'
import { equal } from 'assert'

await test('mem', async (t) => {
  const db = new BasedDb({
    path: t.tmp,
    // low amount to force many flushes
    maxModifySize: 10000,
  })

  await db.start({ clean: true })

  t.after(() => {
    return db.destroy()
  })

  db.putSchema({
    types: {
      data: {
        props: {
          a: { ref: 'data', prop: 'b', $derp: 'uint16' },
          b: { items: { prop: 'a', ref: 'data' } },
          age: { type: 'uint32' },
          name: { type: 'string' },
        },
      },
    },
  })

  const amount = 1e3
  const repeat = 1e3
  // 2M inserts rmeoves

  for (let j = 0; j < repeat; j++) {
    // To keep many different blocks
    await db.create('data', {
      age: 666,
      name: 'BASIC ' + j,
    })

    const ids = []
    let cnt = 0
    for (let i = 0; i < amount; i++) {
      const x = ids[Math.floor(Math.random() * ids.length)]
      if (x) {
        cnt++
      }
      ids.push(
        db.create('data', {
          age: i,
          name: `Mr FLAP ${i}`,
          a: x
            ? { id: ids[Math.floor(Math.random() * ids.length)], $derp: i }
            : null,
        }),
      )
    }

    await db.drain()

    equal(
      (
        await db
          .query('data')
          .include('b')
          .filter('b', 'exists')
          .range(0, amount)
          .get()
      ).length > 1,
      true,
    )

    for (let i = 0; i < amount; i++) {
      db.delete('data', ids[i].tmpId)
    }

    await db.drain()

    equal((await db.query('data').range(0, 10e6).get()).length, j + 1)

    // console.log(`Ran ${j + 1} / ${repeat}`)
  }
})
