import test from 'ava'
import { BasedSchema, setWalker, BasedSetOptionalHandlers } from '../src/index'

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

const createHandlers = (): {
  results: { path: (number | string)[]; value: any }[]
  handlers: BasedSetOptionalHandlers
} => {
  const results: { path: (number | string)[]; value: any }[] = []
  const handlers = {
    collect: ({ path, value, typeSchema, fieldSchema, target }) => {
      results.push({ path, value })
    },
    checkRequiredFields: async (paths) => {
      return true
    },
    referenceFilterCondition: async (id, filter) => {
      return true
    },
  }
  return { results, handlers }
}

test('arrayNum', async (t) => {
  const { handlers, results } = createHandlers()
  await t.throwsAsync(
    setWalker(
      schema,
      {
        $id: 'bl1',
        arrNum: ['1', '2'],
      },
      handlers
    )
  )
  await t.throwsAsync(
    setWalker(
      schema,
      {
        $id: 'bla',
        ref: 1,
      },
      handlers
    )
  )

  await setWalker(
    schema,
    {
      $id: 'bla',
      arrNum: [1, 2],
    },
    handlers
  )
  t.deepEqual(results, [
    { path: ['arrNum'], value: { $delete: true } },
    { path: ['arrNum', 0], value: 1 },
    { path: ['arrNum', 1], value: 2 },
  ])
})

test.only('value arr', async (t) => {
  const { handlers, results } = createHandlers()
  await t.throwsAsync(
    setWalker(
      schema,
      {
        $id: 'bl1',
        arrNum: { $value: ['1', '2'] },
      },
      handlers
    )
  )
  await t.throwsAsync(
    setWalker(
      schema,
      {
        $id: 'bla',
        ref: { $value: 1 },
      },
      handlers
    )
  )

  await setWalker(
    schema,
    {
      $id: 'bla',
      arrNum: [{ $value: 1 }, { $value: 2 }],
    },
    handlers
  )
  // await setWalker(
  //   schema,
  //   {
  //     $id: 'bla',
  //     arrNum: { $value: [1, 2] },
  //   },
  //   handlers
  // )
  console.log(results)
  t.deepEqual(results, [
    // { path: ['arrNum'], value: { $delete: true } },
    // { path: ['arrNum', 0], value: 1 },
    // { path: ['arrNum', 1], value: 2 },
    { path: ['arrNum'], value: { $delete: true } },
    { path: ['arrNum', 0], value: { $value: 1 } },
    { path: ['arrNum', 1], value: { $value: 2 } },
  ])
})

test('default arr', async (t) => {
  const { handlers, results } = createHandlers()

  await t.throwsAsync(
    setWalker(
      schema,
      {
        $id: 'bl1',
        arrNum: ['1', '2'],
      },
      handlers
    )
  )
  await t.throwsAsync(
    setWalker(
      schema,
      {
        $id: 'bla',
        ref: 1,
      },
      handlers
    )
  )

  await setWalker(
    schema,
    {
      $id: 'bla',
      arrNum: [{ $default: 1 }, { $default: 2 }],
    },
    handlers
  )
  await setWalker(
    schema,
    {
      $id: 'bla',
      arrNum: { $default: [1, 2] },
    },
    handlers
  )
  console.log(results)
  //is this correct? is it supposed to be different
  t.deepEqual(results, [
    { path: ['arrNum'], value: { $delete: true } },
    { path: ['arrNum', 0], value: { $default: 1 } },
    { path: ['arrNum', 1], value: { $default: 2 } },
    // why are theese two different but for defaultits the same
    { path: ['arrNum'], value: { $default: [1, 2] } },
  ])
})
// test('arrStr', async (t) => {
//   const { handlers, results } = createHandlers()
//   await t.throwsAsync(
//     setWalker(
//       schema,
//       {
//         $id: 'bl1',
//         arrStr: [1, '2'],
//       },
//       handlers
//     )
//   )
//   await t.throwsAsync(
//     setWalker(
//       schema,
//       {
//         $id: 'bla',
//         ref: 1,
//       },
//       handlers
//     )
//   )

//   await setWalker(
//     schema,
//     {
//       $id: 'bla',
//       arrStr: [1, 2],
//     },
//     handlers
//   )
//   t.deepEqual(results, [
//     { path: ['arrStr'], value: { $delete: true } },
//     { path: ['arrStr', 0], value: 1 },
//     { path: ['arrStr', 1], value: 2 },
//   ])
// })
