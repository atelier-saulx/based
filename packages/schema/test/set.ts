import test from 'ava'
import { BasedSchema, setWalker, walk } from '../src/index'
import { wait } from '@saulx/utils'
import { resultCollect } from './utils'

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
        setOfNumbers: {
          type: 'set',
          items: {
            type: 'number',
          },
        },
        setOfInt: {
          type: 'set',
          items: {
            type: 'integer',
          },
        },
        setOfStr: {
          type: 'set',
          items: { type: 'string', minLength: 3, maxLength: 6 },
        },
      },
    },
  },
  $defs: {},
  languages: ['en', 'de', 'nl', 'ro', 'za', 'ae'],
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
    setOfNumbers: [1, 2, 3, 3, 3, 4, 5],
  })

  t.true(r.errors.length === 0)
  t.deepEqual(resultCollect(r), [
    { path: ['setOfNumbers'], value: { $value: [1, 2, 3, 3, 3, 4, 5] } },
  ])
})

test('simple setNum wrongType', async (t) => {
  r = await setWalker(schema, {
    $id: 'bl120',
    setOfNumbers: [1, '2', 3, 4, 5],
  })

  t.true(r.errors.length === 1)
  t.deepEqual(resultCollect(r), [
    { path: ['setOfNumbers'], value: { $value: [1, '2', 3, 4, 5] } },
  ])
})

test('simple set int wrongType', async (t) => {
  r = await setWalker(schema, {
    $id: 'bl120',
    setOfInt: [1, 2.5, 3, 4, 5],
  })

  t.true(r.errors.length === 1)
  t.deepEqual(resultCollect(r), [
    { path: ['setOfInt'], value: { $value: [1, 2.5, 3, 4, 5] } },
  ])
})

test('add single value', async (t) => {
  r = await setWalker(schema, {
    $id: 'bl120',
    setOfNumbers: { $add: 20 },
  })

  t.true(r.errors.length === 0)
  t.deepEqual(resultCollect(r), [
    { path: ['setOfNumbers'], value: { $add: [20] } },
  ])
})

test('add arr', async (t) => {
  r = await setWalker(schema, {
    $id: 'bl120',
    setOfNumbers: { $add: [1, 2, 3, 4, 5, 6] },
  })

  t.true(r.errors.length === 0)
  t.deepEqual(resultCollect(r), [
    { path: ['setOfNumbers'], value: { $add: [1, 2, 3, 4, 5, 6] } },
  ])
})

test('remove', async (t) => {
  r = await setWalker(schema, {
    $id: 'bl120',
    setOfNumbers: { $remove: [1, 2, 3, 4, 5, 6] },
  })

  t.true(r.errors.length === 0)
  t.deepEqual(resultCollect(r), [
    { path: ['setOfNumbers'], value: { $remove: [1, 2, 3, 4, 5, 6] } },
  ])
})

test('simple setStr', async (t) => {
  r = await setWalker(schema, {
    $id: 'bl120',
    setOfStr: ['bla', 'bla', 'asasd', 'asd', 'asd'],
  })

  t.true(r.errors.length === 0)
  t.deepEqual(resultCollect(r), [
    {
      path: ['setOfStr'],
      value: { $value: ['bla', 'bla', 'asasd', 'asd', 'asd'] },
    },
  ])
})

test('simple setStr wrongType', async (t) => {
  r = await setWalker(schema, {
    $id: 'bl120',
    setOfStr: ['bla', 'bla', 'asasd', 'asd', 2],
  })

  t.true(r.errors.length === 1)
  t.deepEqual(resultCollect(r), [
    {
      path: ['setOfStr'],
      value: { $value: ['bla', 'bla', 'asasd', 'asd', 2] },
    },
  ])
})

test('simple setStr min max', async (t) => {
  r = await setWalker(schema, {
    $id: 'bl120',
    setOfStr: ['bla', 'bla', 'asasdasdasd', 'asd', '2'],
  })

  t.true(r.errors.length === 2)
  t.deepEqual(resultCollect(r), [
    {
      path: ['setOfStr'],
      value: { $value: ['bla', 'bla', 'asasdasdasd', 'asd', '2'] },
    },
  ])
})

test('add single value str', async (t) => {
  r = await setWalker(schema, {
    $id: 'bl120',
    setOfStr: { $add: 'one' },
  })

  t.true(r.errors.length === 0)
  t.deepEqual(resultCollect(r), [
    { path: ['setOfStr'], value: { $add: ['one'] } },
  ])
})

test('add arr str', async (t) => {
  r = await setWalker(schema, {
    $id: 'bl120',
    setOfStr: { $add: ['bla', 'bla', 'asasd', 'asd', 'asd'] },
  })

  t.true(r.errors.length === 0)
  t.deepEqual(resultCollect(r), [
    {
      path: ['setOfStr'],
      value: { $add: ['bla', 'bla', 'asasd', 'asd', 'asd'] },
    },
  ])
})

test('remove str', async (t) => {
  r = await setWalker(schema, {
    $id: 'bl120',
    setOfStr: { $remove: ['bla', 'bla', 'asasd', 'asd', 'asd'] },
  })

  t.true(r.errors.length === 0)
  t.deepEqual(resultCollect(r), [
    {
      path: ['setOfStr'],
      value: { $remove: ['bla', 'bla', 'asasd', 'asd', 'asd'] },
    },
  ])
})
