import assert from 'node:assert'
import test from './shared/test.js'
import { perf } from './shared/assert.js'
import { testDb } from './shared/index.js'

await test('await updates', async (t) => {
  const status = ['a', 'b', 'c', 'd', 'e', 'f']
  const db = await testDb(t, {
    types: {
      user: {
        props: {
          externalId: { type: 'string', max: 20 },
          status,
        },
      },
    },
  })

  const total = 1e4

  for (let i = 0; i < total; i++) {
    db.create('user', {
      externalId: i + '-alias',
      status: 'a',
    })
  }

  await db.isModified()

  let totalAlias = 0

  const updateAlias = async () => {
    const id = Math.ceil(Math.random() * total)
    await db.update('user', id, {
      status: status[~~Math.random() * status.length],
    })
    await db.drain()
    totalAlias++
  }

  //let lastMeasure = performance.now()
  let i = 0
  const t1 = await perf(
    async () => {
      await updateAlias()
      if (!(i % 500)) {
        //const opsPerS = totalAlias / ((performance.now() - lastMeasure) / 1e3)
        // console.log(`${~~opsPerS} per sec`)
        //lastMeasure = performance.now()
        totalAlias = 0
      }
      i++
    },
    'update alias',
    { repeat: 100_000 },
  )
  assert(t1 < 3e3, 'should be smaller than 3s')
})
