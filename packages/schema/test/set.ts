import test from 'ava'
import { BasedSchema, setWalker } from '../src/index.js'
import { resultCollect } from './utils/index.js'
let r
const schema: BasedSchema = {
  types: {
    thing: {
      prefix: 'ti',
      fields: {
        something: { type: 'string', format: 'strongPassword' },
      },
    },
    bla: {
      prefix: 'bl',
      fields: {
        x: {
          type: 'object',
          properties: {
            bla: { type: 'string' },
          },
        },
        setOfNumbers: {
          type: 'set',
          items: {
            type: 'number',
          },
        },
        bla: {
          type: 'set',
          items: { type: 'string', minLength: 3, maxLength: 6 },
        },
      },
    },
  },
  $defs: {},
  language: 'en',
  translations: ['de', 'nl', 'ro', 'za', 'ae'],
  root: {
    fields: {},
  },
  prefixToTypeMapping: {
    bl: 'bla',
    ti: 'thing',
  },
}

test('simple setNum', async (t) => {
  r = await setWalker(schema, {
    $id: 'bl120',
    setOfNumbers: [1, 2, 3, 4, 5],
  })

  t.true(r.errors.length === 0)
  t.deepEqual(resultCollect(r), [
    { path: ['setOfNumbers'], value: { $value: [1, 2, 3, 4, 5] } },
  ])
})

test('default arr', async (t) => {
  r = await setWalker(schema, {
    $id: 'bl120',
    setOfNumbers: { $add: 20 },
  })

  t.true(r.errors.length === 0)
  t.deepEqual(resultCollect(r), [
    { path: ['setOfNumbers'], value: { $add: [20] } },
  ])
})

test('$merge on object', async (t) => {
  r = await setWalker(schema, {
    $id: 'bl120',
    x: {
      $merge: false,
      bla: 'x',
    },
  })

  t.true(r.errors.length === 0)
  t.deepEqual(resultCollect(r), [
    { path: ['x'], value: { $delete: true } },

    { path: ['x', 'bla'], value: 'x' },

    { path: ['x'], value: { $merge: false, bla: 'x' } },
  ])
})

test('$merge on set', async (t) => {
  r = await setWalker(schema, {
    $id: 'bl120',
    $merge: false,
    x: {
      bla: 'x',
    },
  })
  t.true(r.errors.length === 0)
  t.deepEqual(resultCollect(r), [
    { path: ['x', 'bla'], value: 'x' },
    { path: ['x'], value: { bla: 'x' } },
  ])
})
