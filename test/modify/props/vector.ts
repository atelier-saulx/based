import { testDb } from '../../shared/index.js'
import test from '../../shared/test.js'
import assert from 'node:assert'

await test('modify vector', async (t) => {
  const db = await testDb(t, {
    types: {
      thing: {
        vec: { type: 'vector', size: 3, baseType: 'float32' },
      },
    },
  })

  const v1 = new Float64Array([1.1, 2.2, 3.3])
  const id1 = await db.create('thing', {
    vec: v1,
  })

  // Float precision might require approximate equality or strict check if implementation preserves bits
  // For now assuming deepEqual works or we might need a tolerance check
  const res = await db.query('thing', id1).get().toObject()

  // Convert result back to array if it is returned as TypedArray
  const vecArr = Array.from(res.vec) as number[]

  // Check approximate values
  assert(Math.abs(vecArr[0] - v1[0]) < 0.0001)
  assert(Math.abs(vecArr[1] - v1[1]) < 0.0001)
  assert(Math.abs(vecArr[2] - v1[2]) < 0.0001)

  const v2 = new Float64Array([4.4, 5.5, 6.6])
  await db.update('thing', id1, {
    vec: v2,
  })

  const res2 = await db.query('thing', id1).get().toObject()
  const vecArr2 = Array.from(res2.vec) as number[]

  assert(Math.abs(vecArr2[0] - v2[0]) < 0.0001)
  assert(Math.abs(vecArr2[1] - v2[1]) < 0.0001)
  assert(Math.abs(vecArr2[2] - v2[2]) < 0.0001)
})

await test('modify colvec', async (t) => {
  const db = await testDb(t, {
    types: {
      thing: {
        insertOnly: true,
        props: {
          vec: { type: 'colvec', size: 3, baseType: 'float32' },
        },
      },
    },
  })

  // colvec behaves similarly to vector in terms of setting/getting from client perspective
  // but internally stored differently (columnar).
  const v1 = new Float64Array([1.1, 2.2, 3.3])
  const id1 = await db.create('thing', {
    vec: v1,
  })

  const res = await db.query('thing', id1).get().toObject()
  const vecArr = Array.from(res.vec) as number[]

  assert(Math.abs(vecArr[0] - v1[0]) < 0.0001)
  assert(Math.abs(vecArr[1] - v1[1]) < 0.0001)
  assert(Math.abs(vecArr[2] - v1[2]) < 0.0001)

  const v2 = new Float64Array([4.4, 5.5, 6.6])
  await db.update('thing', id1, {
    vec: v2,
  })

  const res2 = await db.query('thing', id1).get().toObject()
  const vecArr2 = Array.from(res2.vec) as number[]

  assert(Math.abs(vecArr2[0] - v2[0]) < 0.0001)
  assert(Math.abs(vecArr2[1] - v2[1]) < 0.0001)
  assert(Math.abs(vecArr2[2] - v2[2]) < 0.0001)
})

await test('modify vector on edge', async (t) => {
  const db = await testDb(t, {
    types: {
      thing: {
        vec: { type: 'vector', size: 3, baseType: 'float32' },
      },
      holder: {
        toThing: {
          ref: 'thing',
          prop: 'holders',
          $edgeVec: { type: 'vector', size: 3, baseType: 'float32' },
        },
      },
    },
  })

  const v1 = new Float64Array([1.1, 2.2, 3.3])
  const targetId = await db.create('thing', { vec: v1 })
  const id1 = await db.create('holder', {
    toThing: {
      id: targetId,
      $edgeVec: v1,
    },
  })

  const res = await db
    .query('holder', id1)
    .include('toThing.$edgeVec')
    .get()
    .toObject()

  if (res.toThing) {
    const vecArr = Array.from(res.toThing.$edgeVec) as number[]
    assert(Math.abs(vecArr[0] - v1[0]) < 0.0001)
    assert(Math.abs(vecArr[1] - v1[1]) < 0.0001)
    assert(Math.abs(vecArr[2] - v1[2]) < 0.0001)
  } else {
    assert.fail('toThing not found')
  }

  const v2 = new Float64Array([4.4, 5.5, 6.6])
  await db.update('holder', id1, {
    toThing: {
      id: targetId,
      $edgeVec: v2,
    },
  })

  const res2 = await db
    .query('holder', id1)
    .include('toThing.$edgeVec')
    .get()
    .toObject()

  if (res2.toThing) {
    const vecArr2 = Array.from(res2.toThing.$edgeVec) as number[]
    assert(Math.abs(vecArr2[0] - v2[0]) < 0.0001)
    assert(Math.abs(vecArr2[1] - v2[1]) < 0.0001)
    assert(Math.abs(vecArr2[2] - v2[2]) < 0.0001)
  }
})
