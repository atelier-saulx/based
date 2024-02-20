import test from 'ava'
import { BasedSchema, setWalker } from '../src/index.js'
import { resultCollect, errorCollect } from './utils/index.js'

const schema: BasedSchema = {
  types: {
    bla: {
      prefix: 'bl',
      fields: {
        number: {
          type: 'number',
          maximum: 6,
          minimum: 3,
        },
        infiniteNum: {
          type: 'number',
        },
        infiniteInt: {
          type: 'integer',
        },
        exclusiveminmax: {
          type: 'number',
          minimum: 3,
          exclusiveMinimum: true,
          maximum: 6,
          exclusiveMaximum: true,
        },
        integer: {
          type: 'integer',
        },
        multipleOf: {
          type: 'integer',
          multipleOf: 3,
        },
        set: {
          type: 'set',
          items: { type: 'number', minimum: 3, maximum: 6 },
        },
      },
    },
  },
  $defs: {},
  language: 'en',
  root: {
    fields: {},
  },
  prefixToTypeMapping: {
    bl: 'bla',
  },
}

//todo need help typing this maybe

test('min-max', async (t) => {
  const e1 = await setWalker(schema, {
    $id: 'bl1',
    number: 1,
  })

  const e2 = await setWalker(schema, {
    $id: 'bl1',
    number: 10,
  })

  const res1 = await setWalker(schema, {
    $id: 'bl1',
    number: 3,
  })

  const res2 = await setWalker(schema, {
    $id: 'bl1',
    number: 6,
  })

  t.true(errorCollect(e1, e2).length > 0)

  t.deepEqual(resultCollect(res1, res2), [
    { path: ['number'], value: 3 },
    { path: ['number'], value: 6 },
  ])
})

test('min-max exclusive', async (t) => {
  const e1 = await setWalker(schema, {
    $id: 'bl1',
    exclusiveminmax: 3,
  })

  const e2 = await setWalker(schema, {
    $id: 'bl1',
    exclusiveminmax: 6,
  })

  const res1 = await setWalker(schema, {
    $id: 'bl1',
    exclusiveminmax: 4,
  })

  const res2 = await setWalker(schema, {
    $id: 'bl1',
    exclusiveminmax: 5,
  })

  t.assert(errorCollect(e1, e2).length > 0)

  t.deepEqual(resultCollect(res1, res2), [
    { path: ['exclusiveminmax'], value: 4 },
    { path: ['exclusiveminmax'], value: 5 },
  ])
})

test('isInteger', async (t) => {
  const e1 = await setWalker(schema, {
    $id: 'bl1',
    integer: 6.5,
  })

  const res1 = await setWalker(schema, {
    $id: 'bl1',
    integer: 5,
  })

  t.assert(errorCollect(e1).length > 0)
  t.deepEqual(resultCollect(res1), [{ path: ['integer'], value: 5 }])
})

test('isMultiple', async (t) => {
  const e1 = await setWalker(schema, {
    $id: 'bl1',
    multipleOf: 7,
  })

  const res1 = await setWalker(schema, {
    $id: 'bl1',
    multipleOf: 9,
  })

  t.assert(errorCollect(e1).length > 0)
  t.deepEqual(resultCollect(res1), [{ path: ['multipleOf'], value: 9 }])
})

//TODO fix
test('numbers in a set', async (t) => {
  const e1 = await setWalker(schema, {
    $id: 'bl1',
    set: [9, 4, 5, 2],
  })
  const res1 = await setWalker(schema, { $id: 'bl1', set: [3, 3, 3, 3] })

  t.assert(errorCollect(e1).length > 0)
  t.deepEqual(resultCollect(res1), [
    { path: ['set'], value: { $value: [3, 3, 3, 3] } },
  ])
})
//TODO fix
test('value', async (t) => {
  const e1 = await setWalker(schema, {
    $id: 'bl1',
    number: { $value: 7 },
  })
  const e2 = await setWalker(schema, {
    $id: 'bl1',
    exclusiveminmax: { $value: 3 },
  })
  const e3 = await setWalker(schema, {
    $id: 'bl1',
    integer: { value: 3.5 },
  })

  const e4 = await setWalker(schema, {
    $id: 'bl1',
    set: { $value: [1, 3, 3, 4] },
  })

  const e5 = await setWalker(schema, {
    $id: 'bl1',
    multipleOf: { $value: 2 },
  })

  const res1 = await setWalker(schema, {
    $id: 'bl1',
    number: { $value: 4 },
  })
  const res2 = await setWalker(schema, {
    $id: 'bl1',
    integer: { $value: 4 },
  })
  const res3 = await setWalker(schema, {
    $id: 'bl1',
    exclusiveminmax: { $value: 4 },
  })
  const res4 = await setWalker(schema, {
    $id: 'bl1',
    multipleOf: { $value: 6 },
  })

  await setWalker(schema, {
    $id: 'bl1',
    set: { $value: [3, 3, 3, 4] },
  })

  t.assert(errorCollect(e1, e2, e3, e4, e5).length > 0)
  t.deepEqual(resultCollect(res1, res2, res3, res4), [
    { path: ['number'], value: 4 },
    { path: ['integer'], value: 4 },
    { path: ['exclusiveminmax'], value: 4 },
    { path: ['multipleOf'], value: 6 },
  ])
})

test('default', async (t) => {
  const e1 = await setWalker(schema, {
    $id: 'bl1',
    number: { $default: 7 },
  })
  const e2 = await setWalker(schema, {
    $id: 'bl1',
    exclusiveminmax: { $default: 3 },
  })
  const e3 = await setWalker(schema, {
    $id: 'bl1',
    integer: { default: 3.5 },
  })

  const e4 = await setWalker(schema, {
    $id: 'bl1',
    set: { $default: [1, 3, 3, 4] },
  })

  const e5 = await setWalker(schema, {
    $id: 'bl1',
    multipleOf: { $default: 2 },
  })

  const res1 = await setWalker(schema, {
    $id: 'bl1',
    number: { $default: 4 },
  })
  const res2 = await setWalker(schema, {
    $id: 'bl1',
    integer: { $default: 4 },
  })
  const res3 = await setWalker(schema, {
    $id: 'bl1',
    exclusiveminmax: { $default: 4 },
  })
  const res4 = await setWalker(schema, {
    $id: 'bl1',
    multipleOf: { $default: 6 },
  })

  const res5 = await setWalker(schema, {
    $id: 'bl1',
    set: { $default: [3, 3, 3, 4] },
  })

  t.assert(errorCollect(e1, e2, e3, e4, e5).length > 0)
  t.deepEqual(resultCollect(res1, res2, res3, res4, res5), [
    { path: ['number'], value: { $default: 4 } },
    { path: ['integer'], value: { $default: 4 } },
    { path: ['exclusiveminmax'], value: { $default: 4 } },
    { path: ['multipleOf'], value: { $default: 6 } },
    { path: ['set'], value: { $default: { $value: [3, 3, 3, 4] } } },
  ])
})

test('decrement', async (t) => {
  //maxmin
  const e1 = await setWalker(schema, {
    $id: 'bl1',
    number: { $decrement: 2 },
  })
  const e2 = await setWalker(schema, {
    $id: 'bl1',
    number: { $decrement: 7 },
  })

  const res1 = await setWalker(schema, {
    $id: 'bl1',
    number: { $decrement: 3 },
  })
  //exclusiveminmax
  const e3 = await setWalker(schema, {
    $id: 'bl1',
    exclusiveminmax: { $decrement: 3 },
  })
  const e4 = await setWalker(schema, {
    $id: 'bl1',
    exclusiveminmax: { $decrement: 6 },
  })

  const res2 = await setWalker(schema, {
    $id: 'bl1',
    exclusiveminmax: { $decrement: 4 },
  })

  //integer
  const e5 = await setWalker(schema, {
    $id: 'bl1',
    integer: { $decrement: 3.5 },
  })

  const res3 = await setWalker(schema, {
    $id: 'bl1',
    integer: { $decrement: 3 },
  })
  //multiple of

  const e6 = await setWalker(schema, {
    $id: 'bl1',
    multipleOf: { $decrement: 7 },
  })

  const res4 = await setWalker(schema, {
    $id: 'bl1',
    multipleOf: { $decrement: 9 },
  })

  t.assert(errorCollect(e1, e2, e3, e4, e5, e6).length > 0)
  t.deepEqual(resultCollect(res1, res2, res3, res4), [
    { path: ['number'], value: { $decrement: 3 } },
    { path: ['exclusiveminmax'], value: { $decrement: 4 } },
    { path: ['integer'], value: { $decrement: 3 } },
    { path: ['multipleOf'], value: { $decrement: 9 } },
  ])
})

test('increment', async (t) => {
  //maxmin
  const e1 = await setWalker(schema, {
    $id: 'bl1',
    number: { $increment: 2 },
  })
  const e2 = await setWalker(schema, {
    $id: 'bl1',
    number: { $increment: 7 },
  })

  const res1 = await setWalker(schema, {
    $id: 'bl1',
    number: { $increment: 3 },
  })
  //exclusiveminmax
  const e3 = await setWalker(schema, {
    $id: 'bl1',
    exclusiveminmax: { $increment: 3 },
  })
  const e4 = await setWalker(schema, {
    $id: 'bl1',
    exclusiveminmax: { $increment: 6 },
  })

  const res2 = await setWalker(schema, {
    $id: 'bl1',
    exclusiveminmax: { $increment: 4 },
  })

  //integer
  const e5 = await setWalker(schema, {
    $id: 'bl1',
    integer: { $increment: 3.5 },
  })

  const res3 = await setWalker(schema, {
    $id: 'bl1',
    integer: { $increment: 3 },
  })
  //multiple of

  const e6 = await setWalker(schema, {
    $id: 'bl1',
    multipleOf: { $increment: 7 },
  })

  const res4 = await setWalker(schema, {
    $id: 'bl1',
    multipleOf: { $increment: 9 },
  })

  t.assert(errorCollect(e1, e2, e3, e4, e5, e6).length > 0)
  t.deepEqual(resultCollect(res1, res2, res3, res4), [
    { path: ['number'], value: { $increment: 3 } },
    { path: ['exclusiveminmax'], value: { $increment: 4 } },
    { path: ['integer'], value: { $increment: 3 } },
    { path: ['multipleOf'], value: { $increment: 9 } },
  ])
})

test('NaN', async (t) => {
  const r = await setWalker(schema, {
    $id: 'bl120',
    integer: NaN,
  })
  t.is(r.errors.length, 1)
})

test('Infinity (integer)', async (t) => {
  const r = await setWalker(schema, {
    $id: 'bl120',
    integer: Infinity,
  })
  t.is(r.errors.length, 1)
})

test('Infinity (number)', async (t) => {
  const r = await setWalker(schema, {
    $id: 'bl120',
    infiniteNum: Infinity,
  })
  t.is(r.errors.length, 1)
})

test('number -infinity', async (t) => {
  const r = await setWalker(schema, {
    $id: 'bl120',
    infiniteNum: -Infinity,
  })
  t.is(r.errors.length, 1)
})

test('number with max infinity', async (t) => {
  const r = await setWalker(schema, {
    $id: 'bl120',
    number: Infinity,
  })
  t.is(r.errors.length, 1)
})
