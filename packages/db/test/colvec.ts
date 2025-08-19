import { BasedDb } from '../src/index.js'
import test from './shared/test.js'
import { deepEqual } from './shared/assert.js'

await test('colvec', async (t) => {
  const db = new BasedDb({
    path: t.tmp,
  })
  await db.start({ clean: true })
  t.after(() => t.backup(db))

  await db.setSchema({
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

  deepEqual(db.server.schemaTypesParsed['col'].blockCapacity, 10_000)

  let seed = 100
  const next = () => (seed = (214013 * seed + 2531011) % 10e3)
  const reset = () => seed = 100
  const vec = new Float32Array(8)
  const genVec = () => {
    for (let j = 0; j < 8; j++) {
      vec[j] = next()
    }
  }
  const N = 10_000_000

  reset()
  const trow0 = performance.now()
  for (let i = 0; i < N; i++) {
    genVec()
    db.create('row', { vec })
  }
  await db.drain()
  const trow1 = performance.now()

  reset()
  const tcol0 = performance.now()
  for (let i = 0; i < N; i++) {
    genVec()
    db.create('col', { vec })
  }
  await db.drain()
  const tcol1 = performance.now()

  console.log(`CREATE row: ${trow1 - trow0} ms col: ${tcol1 - tcol0} ms`)

  vec[0] = 2311.0
  vec[1] = 5054.0
  vec[2] = 2713.0
  vec[3] = 8280.0
  vec[4] = 8651.0
  vec[5] = 7474.0
  vec[6] = 4173.0
  vec[7] = 7261.0
  const tr0 = performance.now()
  await db
    .query('row')
    .include('*')
    .filter('vec', 'like', vec, { fn: 'euclideanDistance', score: 1 })
    .get()
  const tr1 = performance.now()
  console.log(`QUERY row: ${tr1 - tr0} ms`)

  const tc0 = performance.now()
  global.__basedDb__native__.colvecTest(db.server.dbCtxExternal, 3, 1, 1, N + 1)
  const tc1 = performance.now()
  console.log(`QUERY col: ${tc1 - tc0} ms`)

  const res = await db
    .query('col')
    .include('vec')
    .range(0, 2)
    .get()
    .toObject()
  deepEqual(
    res,
    [
      {
        id: 1,
        vec: new Float32Array([
          2311,
          5054,
          1.5612034346858506e-39,
          1.007378107771942e-37,
          3.76158192263132e-37,
          1.6815581571897805e-44,
          0,
          5391
        ])
      },
      {
        id: 2,
        vec: new Float32Array([
          5391,
          5094,
          1.5612034346858506e-39,
          4.029512431087768e-37,
          3.76158192263132e-37,
          1.6815581571897805e-44,
          0,
          6071
        ])
      }
    ])
})

await test('colvec int8', async (t) => {
  const db = new BasedDb({
    path: t.tmp,
  })
  await db.start({ clean: true })
  t.after(() => t.backup(db))

  await db.setSchema({
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
    db.create('col', {
      str: Int8Array.from([i + 1, i + 2, i + 3, i + 4]),
    })
  }
  deepEqual(await db.query('col').include('str').get(),
    [
      { id: 1, str: new Int8Array([ 1, 2, 3, 4 ]) },
      { id: 2, str: new Int8Array([ 2, 3, 4, 5 ]) },
      { id: 3, str: new Int8Array([ 3, 4, 5, 6 ]) },
      { id: 4, str: new Int8Array([ 4, 5, 6, 7 ]) },
      { id: 5, str: new Int8Array([ 5, 6, 7, 8 ]) }
    ]
  )
})
