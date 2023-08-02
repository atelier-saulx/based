import test from 'ava'
import { BasedSchema, setWalker } from '../src/index'
import { errorCollect, resultCollect } from './utils'

const schema: BasedSchema = {
  types: {
    bla: {
      prefix: 'bl',
      fields: {
        arrNum: {
          type: 'array',
          values: {
            type: 'number',
          },
        },
        arrStr: {
          type: 'array',
          values: {
            type: 'string',
          },
        },
      },
    },
  },
  $defs: {},
  languages: ['en'],
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

test.only('value arr', async (t) => {
  const err = await setWalker(schema, {
    $id: 'bl1',
    arrNum: { $value: ['1', '2'] },
  })
  const err1 = await setWalker(schema, {
    $id: 'bla',
    ref: { $value: 1 },
  })

  const res = await setWalker(schema, {
    $id: 'bla',
    arrNum: [{ $value: 1 }, { $value: 2 }],
  })
  const res1 = await setWalker(schema, {
    $id: 'bla',
    arrNum: { $value: [1, 2] },
  })

  t.true(errorCollect(err, err1).length > 0)
  console.log(resultCollect(res, res1))

  t.deepEqual(resultCollect(res, res1), [
    { path: ['arrNum'], value: { $delete: true } },
    { path: ['arrNum', 0], value: 1 },
    { path: ['arrNum', 1], value: 2 },
    { path: ['arrNum'], value: { $delete: true } },
    { path: ['arrNum', 0], value: 1 },
    { path: ['arrNum', 1], value: 2 },
    { path: ['arrNum'], value: { $delete: true } },
  ])

  // { path: ['arrNum'], value: { $delete: true } },
  // { path: ['arrNum', 0], value: { $value: 1 } }, // just 1
  // { path: ['arrNum', 1], value: { $value: 2 } }, // just 2
  // { path: ['arrNum'], value: { $delete: true } },
  // { path: ['arrNum', 0], value: 1 },
  // { path: ['arrNum', 1], value: 2 },
})

test('default arr', async (t) => {
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
  //is this correct? is it supposed to be different
  t.deepEqual(resultCollect(res, res1), [
    { path: ['arrNum'], value: { $delete: true } },
    { path: ['arrNum', 0], value: { $default: 1 } },
    { path: ['arrNum', 1], value: { $default: 2 } },
    // why are theese two different but for defaultits the same
    { path: ['arrNum'], value: { $default: [1, 2] } },
  ])
})
// test('arrStr', async (t) => {
//
//   const err = await(
//     setWalker(
//       schema,
//       {
//         $id: 'bl1',
//         arrStr: [1, '2'],
//       },
//
//     )
//   )
//   const err = await(
//     setWalker(
//       schema,
//       {
//         $id: 'bla',
//         ref: 1,
//       },
//
//     )
//   )

//   await setWalker(
//     schema,
//     {
//       $id: 'bla',
//       arrStr: [1, 2],
//     },
//
//   )
//   t.deepEqual(results, [
//     { path: ['arrStr'], value: { $delete: true } },
//     { path: ['arrStr', 0], value: 1 },
//     { path: ['arrStr', 1], value: 2 },
//   ])
// })
