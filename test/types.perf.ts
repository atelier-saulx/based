import { BasedDb } from '../src/index.js'
import test from './shared/test.js'
import { perf } from './shared/assert.js'
import { fastPrng } from '../src/utils/fastPrng.js'
import { testDb } from './shared/index.js'

const NR_TYPES = 16384

await test('create and access many types', async (t) => {
  const prng = fastPrng()
  const rndType = () => `type${prng(1, NR_TYPES)}`

  const db = await testDb(t, {
    types: Object.fromEntries(
      Array.from({ length: 16384 }, (_, i) => [
        `type${i + 1}`,
        { bool: 'boolean' },
      ]),
    ),
  })

  await perf(
    () => {
      db.create(rndType(), {
        bool: true,
      })
    },
    'create booleans',
    { repeat: 1_000_000 },
  )

  await db.drain()
})

await test('create many nodes', async (t) => {
  const db = await testDb(t, {
    types: {
      type: { bool: 'boolean' },
    },
  })

  await perf(
    () => {
      db.create('type', {
        bool: true,
      })
    },
    'create booleans',
    { repeat: 10_000_000 },
  )

  await db.drain()
})
