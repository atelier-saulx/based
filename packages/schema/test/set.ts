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
        bla: {
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

// test.only('default arr', async (t) => {
//   r = await setWalker(schema, {
//     $id: 'bl120',
//     setOfNumbers: { $add: [1, 2, 3, 4, 5, 6] },
//   })

//   console.log(r.errors)
//   console.dir(
//     r.collected.map((v) => ({ path: v.path, value: v.value })),
//     { depth: 10 }
//   )
//   t.true(r.errors.length === 0)
// })

// test.only('default arr', async (t) => {
//   r = await setWalker(schema, {
//     $id: 'bl120',
//     setOfNumbers: { $remove: [1, 2, 3, 4, 5, 6] },
//   })

//   console.log(r.errors)
//   console.dir(
//     r.collected.map((v) => ({ path: v.path, value: v.value })),
//     { depth: 10 }
//   )
// })
