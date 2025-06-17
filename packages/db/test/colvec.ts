import { BasedDb } from '../src/index.js'
import test from './shared/test.js'
import { deepEqual } from './shared/assert.js'

await test('colvec', async (t) => {
  const db = new BasedDb({
    path: t.tmp,
  })
  await db.start({ clean: true })
  //t.after(() => t.backup(db)) TODO
  t.after(() => db.destroy())

  await db.setSchema({
    types: {
      row: {
        props: {
          vec: { type: 'vector', size: 8 },
        },
      },
      col: {
        props: {
          vec: { type: 'colvec', size: 8 },
        },
      },
    },
  })

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
    .inspect()
  const tr1 = performance.now()
  console.log(`QUERY row: ${tr1 - tr0} ms`)

  //await db
  //  .query('col')
  //  .include('*')
  //  .filter('vec', 'like', vec, { fn: 'euclideanDistance', score: 1 })
  //  .get()
  //  .inspect()

  const tc0 = performance.now()
  console.log(global.__basedDb__native__.colvecTest(db.server.dbCtxExternal, 3, 1, 1, N + 1))
  const tc1 = performance.now()
  console.log(`QUERY col: ${tc1 - tc0} ms`)
})
