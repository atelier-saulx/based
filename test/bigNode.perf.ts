import test from './shared/test.js'
import { deepEqual } from './shared/assert.js'
import { SchemaProps, serialize } from '../src/schema/index.js'
import { deSerializeSchema, resultToObject } from '../src/protocol/index.js'
import { testDb } from './shared/index.js'

await test('big nodes', async (t) => {
  const makeALot = (n: number) => {
    const props: SchemaProps = {}
    for (let i = 0; i < n; i++) {
      props[`f${i}`] = { type: 'int32' }
    }
    return props
  }

  const db = await testDb(t, {
    types: {
      mega: {
        props: {
          ...makeALot(4096),
          ref: { type: 'reference', ref: 'giga', prop: 'ref' },
        },
      },
      giga: {
        props: {
          ...makeALot(16383),
          ref: { type: 'reference', ref: 'mega', prop: 'ref' },
        },
      },
    },
  })

  const mega1 = db.create('mega', {})
  await db.drain()

  const mega2 = db.create('mega', {
    f0: 10,
    f4092: 1337,
  })
  await db.drain()

  const giga1 = db.create('giga', {})
  await db.drain()

  const giga2 = db.create('giga', {
    f0: 10,
    f100: 1337,
  })
  await db.drain()

  const mega = await db.query('mega').get()
  const giga = await db.query('giga').get()
  deepEqual(mega[1].f4092, 1337)
  deepEqual(giga[1].f100, 1337)

  db.update('mega', mega1, { ref: giga2 })
  db.update('giga', giga1, { ref: mega2 })
  await db.drain()

  const megaRefQ = await db.query('mega').include('ref').get()

  const megaRef = megaRefQ
  const gigaRef = await db.query('giga').include('ref').get()

  deepEqual(gigaRef[0].ref.id, 2)
  deepEqual(megaRef[1].ref.id, 1)
})
