import { fastPrng } from '../src/utils/index.js'
import { BasedDb } from '../src/index.js'
import test from './shared/test.js'
import { equal } from './shared/assert.js'

await test('mem', async (t) => {
  const db = new BasedDb({
    path: t.tmp,
    // low amount to force many flushes
    maxModifySize: 10000,
  })
  await db.start({ clean: true })
  t.after(() => t.backup(db))

  const client = await db.setSchema({
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

  const rnd = fastPrng()
  for (let j = 0; j < repeat; j++) {
    // To keep many different blocks
    await client.create('data', {
      age: 666,
      name: 'BASIC ' + j,
    })

    const ids: any[] = []
    let cnt = 0
    for (let i = 0; i < amount; i++) {
      const x = ids[rnd(0, ids.length - 1)]
      if (x) {
        cnt++
      }
      ids.push(
        client.create('data', {
          age: i,
          name: `Mr FLAP ${i}`,
          a: x ? { id: ids[rnd(0, ids.length - 1)], $derp: i } : null,
        }),
      )
    }

    await client.drain()
    await client.create('data', {
      age: 667,
      name: 'BASIC2 ' + j,
    })

    equal(
      (
        await client
          .query('data')
          .include('b')
          .filter('b', 'exists')
          .range(0, amount)
          .get()
      ).length > 1,
      true,
    )

    for (let i = 0; i < amount; i++) {
      client.delete('data', ids[i])
    }

    await client.drain()

    equal((await client.query('data').range(0, 10e6).get()).length, (j + 1) * 2)
  }
})
