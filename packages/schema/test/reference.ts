import test from 'ava'
import { BasedSchema, setWalker, BasedSetOptionalHandlers } from '../src/index'

const schema: BasedSchema = {
  types: {
    bla: {
      prefix: 'bl',
      fields: {
        ref: {
          type: 'reference',
          allowedTypes: ['bla'],
        },
        ref2: {
          type: 'references',
          allowedTypes: ['bla'],
        },
        arr: {
          type: 'array',
          title: '',
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

test('reference', async (t) => {
  const { handlers, results } = createHandlers()
  await t.throwsAsync(
    setWalker(
      schema,
      {
        $id: 'bl1',
        ref: ['1', '2'],
      },
      handlers
    )
  )
  await t.throwsAsync(
    setWalker(
      schema,
      {
        $id: 'bl1',
        ref: 1,
      },
      handlers
    )
  )

  await setWalker(
    schema,
    {
      $id: 'bl1',
      ref: 'asdasdasdasdasd',
    },
    handlers
  )
  t.deepEqual(results, [{ path: ['ref'], value: 'asdasdasdasdasd' }])
})

test('multiple references', async (t) => {
  const { handlers, results } = createHandlers()

  // await t.throwsAsync(
  //   setWalker(
  //     schema,
  //     {
  //       $id: 'bl1',
  //       ref2: 0.5,
  //     },
  //     handlers
  //   )
  // )
  // await t.throwsAsync(
  //   setWalker(
  //     schema,
  //     {
  //       $id: 'bl1',
  //       ref2: 1,
  //     },
  //     handlers
  //   )
  // )
  // these should throw, array of refs doesnt
  //??? todo?
  await t.throwsAsync(
    setWalker(
      schema,
      {
        $id: 'bl1',
        ref2: [1, 1, 1, 1, 1, 1, 1],
      },
      handlers
    )
  )
  console.log(results)
  await setWalker(
    schema,
    {
      $id: 'bl1',
      ref2: ['1', '2', '3'],
    },
    handlers
  )
  t.deepEqual(results, [{ path: ['ref2'], value: { $value: ['1', '2', '3'] } }])
})

test('value of references', async (t) => {
  const { handlers, results } = createHandlers()
  await t.throwsAsync(
    setWalker(
      schema,
      {
        $id: 'bl1',
        ref: { $value: ['1', '2'] },
      },
      handlers
    )
  )
  await t.throwsAsync(
    setWalker(
      schema,
      {
        $id: 'bl1',
        ref: { $value: 1 },
      },
      handlers
    )
  )

  await setWalker(
    schema,
    {
      $id: 'bl1',
      ref: { $value: 'asdasdasdasdasd' },
    },
    handlers
  )
  console.log('------------>', results)
  //error here?
  t.deepEqual(results, [
    { path: ['ref'], value: { $value: 'asdasdasdasdasd' } },
  ])
})
test.only('default of references', async (t) => {
  const { handlers, results } = createHandlers()
  await t.throwsAsync(
    setWalker(
      schema,
      {
        $id: 'bl1',
        ref: { $default: ['1', '2'] },
      },
      handlers
    )
  )
  await t.throwsAsync(
    setWalker(
      schema,
      {
        $id: 'bl1',
        ref: { $default: 1 },
      },
      handlers
    )
  )

  // await setWalker(
  //   schema,
  //   {
  //     $id: 'bl1',
  //     ref: { $default: 'asdasdasdasdasd' },
  //   },
  //   handlers
  // )
  // console.log('------------>', results)
  // //error here?
  // t.deepEqual(results, [
  //   { path: ['ref'], value: { $default: 'asdasdasdasdasd' } },
  // ])
})
