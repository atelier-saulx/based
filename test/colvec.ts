import test from './shared/test.js'
import { deepEqual, perf } from './shared/assert.js'
import { testDb } from './shared/index.js'

await test.skip('basic', async (t) => {
  const client = await testDb(t, {
    types: {
      row: {
        props: {
          vec: { type: 'vector', size: 8, baseType: 'float32' },
        },
      },
      col: {
        blockCapacity: 10_000,
        insertOnly: true,
        props: {
          vec: { type: 'colvec', size: 8, baseType: 'float32' },
        },
      },
    },
  })

  deepEqual(client.schemaTypesParsed.col.blockCapacity, 10_000)

  let seed = 100
  const next = () => (seed = (214013 * seed + 2531011) % 10e3)
  const reset = () => (seed = 100)
  const vec = new Float32Array(8)
  const genVec = () => {
    for (let j = 0; j < 8; j++) {
      vec[j] = next()
    }
  }
  const N = 10_000_000

  reset()
  await perf(async () => {
    for (let i = 0; i < N; i++) {
      genVec()
      client.create('row', { vec })
    }
    await client.drain()
  }, 'row')

  reset()
  await perf(async () => {
    for (let i = 0; i < N; i++) {
      genVec()
      client.create('col', { vec })
    }
    await client.drain()
  }, 'col')

  vec[0] = 2311.0
  vec[1] = 5054.0
  vec[2] = 2713.0
  vec[3] = 8280.0
  vec[4] = 8651.0
  vec[5] = 7474.0
  vec[6] = 4173.0
  vec[7] = 7261.0
  await perf(async () => {
    await db
      .query('row')
      .include('*')
      .filter('vec', 'like', vec, { fn: 'euclideanDistance', score: 1 })
      .get()
  }, 'QUERY row')
})

await test('int8 vector', async (t) => {
  const client = await testDb(t, {
    types: {
      col: {
        blockCapacity: 10_000,
        insertOnly: true,
        props: {
          str: { type: 'colvec', size: 4, baseType: 'int8' },
        },
      },
    },
  })

  for (let i = 0; i < 5; i++) {
    client.create('col', {
      str: Int8Array.from([i + 1, i + 2, i + 3, i + 4]),
    })
  }
  await client.drain()

  deepEqual(await client.query('col').include('str').get(), [
    { id: 1, str: new Int8Array([1, 2, 3, 4]) },
    { id: 2, str: new Int8Array([2, 3, 4, 5]) },
    { id: 3, str: new Int8Array([3, 4, 5, 6]) },
    { id: 4, str: new Int8Array([4, 5, 6, 7]) },
    { id: 5, str: new Int8Array([5, 6, 7, 8]) },
  ])
})

await test('float32 vector', async (t) => {
  const client = await testDb(t, {
    types: {
      col: {
        blockCapacity: 10_000,
        insertOnly: true,
        props: {
          str: { type: 'colvec', size: 2, baseType: 'float32' },
        },
      },
    },
  })

  for (let i = 0; i < 1; i++) {
    client.create('col', {
      str: Float32Array.from([1.23123, 1.3]),
    })
  }
  deepEqual(await client.query('col').include('str').get(), [
    { id: 1, str: new Float32Array([1.23123, 1.3]) },
  ])
})
