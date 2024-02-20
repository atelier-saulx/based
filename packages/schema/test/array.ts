import test from 'ava'
import { BasedSchema, setWalker } from '../src/index.js'
import { errorCollect, resultCollect } from './utils/index.js'

const schema: BasedSchema = {
  types: {
    bla: {
      prefix: 'bl',
      fields: {
        arrNum: {
          type: 'array',
          items: {
            type: 'number',
          },
        },
        objArray: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              snurp: {
                type: 'string',
              },
            },
          },
        },
        arrStr: {
          type: 'array',
          items: {
            type: 'string',
          },
        },
        intarray: {
          type: 'array',
          items: {
            type: 'integer',
          },
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

test('arrayNum', async (t) => {
  const err = await setWalker(schema, {
    $id: 'bl1',
    arrNum: ['1', '2'],
  })
  const err1 = await setWalker(schema, {
    $id: 'bla',
    ref: 1,
  })

  const res = await setWalker(schema, {
    $id: 'bla',
    arrNum: [1, 2],
  })

  t.true(errorCollect(err, err1).length > 0)

  t.deepEqual(resultCollect(res), [
    { path: ['arrNum'], value: { $delete: true } },
    { path: ['arrNum', 0], value: 1 },
    { path: ['arrNum', 1], value: 2 },
  ])
})

test('value arr', async (t) => {
  const err = await setWalker(schema, {
    $id: 'bl1',
    arrNum: { $value: ['1', '2'] },
  })

  t.true(err.errors.length > 1)

  const res = await setWalker(schema, {
    $id: 'bla',
    arrNum: [{ $value: 1 }, { $value: 2 }],
  })
  const res1 = await setWalker(schema, {
    $id: 'bla',
    arrNum: { $value: [1, 2] },
  })

  t.deepEqual(resultCollect(res, res1), [
    { path: ['arrNum'], value: { $delete: true } },
    { path: ['arrNum', 0], value: 1 },
    { path: ['arrNum', 1], value: 2 },
    { path: ['arrNum'], value: { $delete: true } },
    { path: ['arrNum', 0], value: 1 },
    { path: ['arrNum', 1], value: 2 },
  ])
})

test.only('default arr', async (t) => {
  const err = await setWalker(schema, {
    $id: 'bl1',
    arrNum: ['1', '2'],
  })
  const err1 = await setWalker(schema, {
    $id: 'bla',
    ref: 1,
  })

  const res = await setWalker(schema, {
    $id: 'bla',
    arrNum: [{ $default: 1 }, { $default: 2 }],
  })
  const res1 = await setWalker(schema, {
    $id: 'bla',
    arrNum: { $default: [1, 2] },
  })

  t.true(errorCollect(err, err1).length > 0)

  t.deepEqual(resultCollect(res, res1), [
    { path: ['arrNum'], value: { $delete: true } },
    { path: ['arrNum', 0], value: { $default: 1 } },
    { path: ['arrNum', 1], value: { $default: 2 } },
    // TODO bit sketchy needs some work
    { path: ['arrNum'], value: { $default: [1, 2] } },
  ])
})

let r

test('assign idx value', async (t) => {
  r = await setWalker(schema, {
    $id: 'bl120',
    intarray: {
      $assign: {
        $idx: 0,
        $value: 6,
      },
    },
  })

  t.deepEqual(resultCollect(r), [{ path: ['intarray', 0], value: 6 }])
})

test('push ints', async (t) => {
  r = await setWalker(schema, {
    $id: 'bl120',
    intarray: {
      $push: [1, 2, 3, 4, 5],
    },
  })

  t.deepEqual(resultCollect(r), [
    { path: ['intarray'], value: { $push: [1, 2, 3, 4, 5] } },
  ])
})

test('push objs', async (t) => {
  r = await setWalker(schema, {
    $id: 'bl120',
    objArray: {
      $push: [{ snurp: 'a' }, { snurp: 'b' }, { snurp: 'c' }],
    },
  })

  t.deepEqual(resultCollect(r), [
    {
      path: ['objArray'],
      value: {
        $push: [{ snurp: 'a' }, { snurp: 'b' }, { snurp: 'c' }],
      },
    },
    { path: ['objArray', -3, 'snurp'], value: 'a' },
    { path: ['objArray', -2, 'snurp'], value: 'b' },
    { path: ['objArray', -1, 'snurp'], value: 'c' },
    { path: ['objArray', -3], value: { snurp: 'a' } },
    { path: ['objArray', -2], value: { snurp: 'b' } },
    { path: ['objArray', -1], value: { snurp: 'c' } },
  ])
})

test('unshift ints', async (t) => {
  r = await setWalker(schema, {
    $id: 'bl120',
    intarray: {
      $unshift: [1, 2, 3, 4, 5],
    },
  })

  t.deepEqual(resultCollect(r), [
    { path: ['intarray'], value: { $unshift: [1, 2, 3, 4, 5] } },
  ])
  t.true(true)
})

test('nested default unshift', async (t) => {
  r = await setWalker(schema, {
    $id: 'bl120',
    intarray: {
      $unshift: [{ $value: 1 }, { $default: 2 }, 3, 4, 5],
    },
  })

  t.is(r.errors.length, 0)

  t.deepEqual(resultCollect(r), [
    {
      path: ['intarray'],
      value: { $unshift: [1, { $default: 2 }, 3, 4, 5] },
    },
  ])
})

test('nested default in push', async (t) => {
  r = await setWalker(schema, {
    $id: 'bl120',
    intarray: {
      $push: [{ $value: 1 }, { $default: 2 }, 3, 4, 5],
    },
  })

  t.is(r.errors.length, 0)

  t.deepEqual(resultCollect(r), [
    {
      path: ['intarray'],
      value: { $push: [1, { $default: 2 }, 3, 4, 5] },
    },
  ])
})

test('assign idx default value error', async (t) => {
  r = await setWalker(schema, {
    $id: 'bl120',
    intarray: {
      $assign: {
        $idx: { $default: 0 },
        $value: 6,
      },
    },
  })
  t.true(r.errors.length > 0)
})

test('assign idx no value', async (t) => {
  r = await setWalker(schema, {
    $id: 'bl120',
    intarray: {
      $assign: {
        $idx: { $default: 0 },
      },
    },
  })
  t.true(r.errors.length > 0)
})

test('assign idx value spelled wrong', async (t) => {
  r = await setWalker(schema, {
    $id: 'bl120',
    intarray: {
      $assign: {
        $idx: 0,
        value: 5,
      },
    },
  })

  t.true(r.errors.length > 0)
})

test('assign idx value wrong type', async (t) => {
  r = await setWalker(schema, {
    $id: 'bl120',
    intarray: {
      $assign: {
        $idx: 0,
        $value: 5.6,
      },
    },
  })

  t.true(r.errors.length > 0)
})

test('assign idx value value wrong type', async (t) => {
  r = await setWalker(schema, {
    $id: 'bl120',
    intarray: {
      $assign: {
        $idx: 0,
        $value: { $value: 5.6 },
      },
    },
  })

  t.true(r.errors.length > 0)
})

test('assign idx default value', async (t) => {
  r = await setWalker(schema, {
    $id: 'bl120',
    intarray: {
      $assign: {
        $idx: 0,
        $value: { $default: 5 },
      },
    },
  })

  t.deepEqual(resultCollect(r), [
    { path: ['intarray', 0], value: { $default: 5 } },
  ])
})

test('assign idx value value error', async (t) => {
  r = await setWalker(schema, {
    $id: 'bl120',
    intarray: {
      $assign: {
        $idx: { $value: 0 },
        $value: 6,
      },
    },
  })

  t.true(r.errors.length > 0)
})

test('insert idx intarray', async (t) => {
  r = await setWalker(schema, {
    $id: 'bl120',
    intarray: {
      $insert: {
        $idx: 10,
        $value: 1212,
      },
    },
  })

  t.true(r.errors.length === 0)
  t.deepEqual(resultCollect(r), [
    {
      path: ['intarray'],
      value: { $insert: { $idx: 10, $value: [1212] } },
    },
  ])
})

test('unshift array', async (t) => {
  r = await setWalker(schema, {
    $id: 'bl120',
    intarray: {
      $unshift: { $value: [-10, -20, -30] },
    },
  })

  t.true(r.errors.length === 0)
  t.deepEqual(resultCollect(r), [
    { path: ['intarray'], value: { $unshift: [-10, -20, -30] } },
  ])
})

test('assign + $delete', async (t) => {
  r = await setWalker(schema, {
    $id: 'bl120',
    objArray: {
      $assign: {
        $idx: 3,
        $value: {
          snurp: {
            $delete: true,
          },
        },
      },
    },
  })

  t.is(r.errors.length, 0)

  t.deepEqual(resultCollect(r), [
    { path: ['objArray', 3, 'snurp'], value: { $delete: true } },
    { path: ['objArray', 3], value: { snurp: { $delete: true } } },
  ])
})
