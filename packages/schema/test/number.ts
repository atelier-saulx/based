import test from 'ava'
import { BasedSchema, setWalker, BasedSetHandlers } from '../src/index'

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
  handlers: BasedSetHandlers
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

test.skip('min-max', async (t) => {
  const { handlers, results } = createHandlers()
  await t.throwsAsync(
    setWalker(
      schema,
      {
        $id: 'bl1',
        number: 1,
      },
      handlers
    )
  )
  await t.throwsAsync(
    setWalker(
      schema,
      {
        $id: 'bl1',
        number: 10,
      },
      handlers
    )
  )
  await setWalker(
    schema,
    {
      $id: 'bl1',
      number: 3,
    },
    handlers
  )

  await setWalker(
    schema,
    {
      $id: 'bl1',
      number: 6,
    },
    handlers
  )
  t.deepEqual(results, [
    { path: ['number'], value: 3 },
    { path: ['number'], value: 6 },
  ])
})
test.skip('min-max exclusive', async (t) => {
  const { handlers, results } = createHandlers()
  await t.throwsAsync(
    setWalker(
      schema,
      {
        $id: 'bl1',
        exclusiveminmax: 3,
      },
      handlers
    )
  )
  console.log('results', results)
  await t.throwsAsync(
    setWalker(
      schema,
      {
        $id: 'bl1',
        exclusiveminmax: 6,
      },
      handlers
    )
  )
  await setWalker(
    schema,
    {
      $id: 'bl1',
      exclusiveminmax: 4,
    },
    handlers
  )

  await setWalker(
    schema,
    {
      $id: 'bl1',
      exclusiveminmax: 5,
    },
    handlers
  )
  t.deepEqual(results, [
    { path: ['exclusiveminmax'], value: 4 },
    { path: ['exclusiveminmax'], value: 5 },
  ])
})
test.skip('isInteger', async (t) => {
  const { handlers, results } = createHandlers()

  await t.throwsAsync(
    setWalker(
      schema,
      {
        $id: 'bl1',
        integer: 6.5,
      },
      handlers
    )
  )

  await setWalker(
    schema,
    {
      $id: 'bl1',
      integer: 5,
    },
    handlers
  )
  t.deepEqual(results, [{ path: ['integer'], value: 5 }])
})
test.skip('isMultiple', async (t) => {
  const { handlers, results } = createHandlers()

  await t.throwsAsync(
    setWalker(
      schema,
      {
        $id: 'bl1',
        multipleOf: 7,
      },
      handlers
    )
  )

  await setWalker(
    schema,
    {
      $id: 'bl1',
      multipleOf: 9,
    },
    handlers
  )
  t.deepEqual(results, [{ path: ['multipleOf'], value: 9 }])
})

test('value', async (t) => {
  const { handlers, results } = createHandlers()

  await t.throwsAsync(
    setWalker(
      schema,
      {
        $id: 'bl1',
        number: { $value: 7 },
      },
      handlers
    )
  )

  await setWalker(
    schema,
    {
      $id: 'bl1',
      number: { $value: 4 },
    },
    handlers
  )
  t.deepEqual(results, [{ path: ['number'], value: { $value: 4 } }])
})
