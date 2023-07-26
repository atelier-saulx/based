import test from 'ava'
import { BasedSchema, setWalker, BasedSetOptionalHandlers } from '../src/index'

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

test('min-max', async (t) => {
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

test('min-max exclusive', async (t) => {
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

test('isInteger', async (t) => {
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

test('isMultiple', async (t) => {
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

test('numbers in a set', async (t) => {
  const { handlers, results } = createHandlers()
  await t.throwsAsync(
    setWalker(
      schema,
      {
        $id: 'bl1',
        set: [9, 4, 5, 2],
      },
      handlers
    )
  )
  await setWalker(schema, { $id: 'bl1', set: [3, 3, 3, 3] }, handlers)
  t.deepEqual(results, [{ path: ['set'], value: { $value: [3, 3, 3, 3] } }])
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
  await t.throwsAsync(
    setWalker(
      schema,
      {
        $id: 'bl1',
        exclusiveminmax: { $value: 3 },
      },
      handlers
    )
  )
  await t.throwsAsync(
    setWalker(
      schema,
      {
        $id: 'bl1',
        integer: { value: 3.5 },
      },
      handlers
    )
  )

  await t.throwsAsync(
    setWalker(
      schema,
      {
        $id: 'bl1',
        set: { $value: [1, 3, 3, 4] },
      },
      handlers
    )
  )

  await t.throwsAsync(
    setWalker(
      schema,
      {
        $id: 'bl1',
        multipleOf: { $value: 2 },
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
  await setWalker(
    schema,
    {
      $id: 'bl1',
      integer: { $value: 4 },
    },
    handlers
  )
  await setWalker(
    schema,
    {
      $id: 'bl1',
      exclusiveminmax: { $value: 4 },
    },
    handlers
  )
  await setWalker(
    schema,
    {
      $id: 'bl1',
      multipleOf: { $value: 6 },
    },
    handlers
  )

  await setWalker(
    schema,
    {
      $id: 'bl1',
      set: { $value: [3, 3, 3, 4] },
    },
    handlers
  )
  t.deepEqual(results, [
    { path: ['number'], value: { $value: 4 } },
    { path: ['integer'], value: { $value: 4 } },
    { path: ['exclusiveminmax'], value: { $value: 4 } },
    { path: ['multipleOf'], value: { $value: 6 } },
    { path: ['set'], value: { $value: [3, 3, 3, 4] } },
  ])
})

test('default', async (t) => {
  const { handlers, results } = createHandlers()

  await t.throwsAsync(
    setWalker(
      schema,
      {
        $id: 'bl1',
        number: { $default: 7 },
      },
      handlers
    )
  )
  await t.throwsAsync(
    setWalker(
      schema,
      {
        $id: 'bl1',
        exclusiveminmax: { $default: 3 },
      },
      handlers
    )
  )
  await t.throwsAsync(
    setWalker(
      schema,
      {
        $id: 'bl1',
        integer: { $default: 3.5 },
      },
      handlers
    )
  )

  await t.throwsAsync(
    setWalker(
      schema,
      {
        $id: 'bl1',
        set: { $default: [1, 3, 3, 4] },
      },
      handlers
    )
  )

  await t.throwsAsync(
    setWalker(
      schema,
      {
        $id: 'bl1',
        multipleOf: { $default: 2 },
      },
      handlers
    )
  )

  await setWalker(
    schema,
    {
      $id: 'bl1',
      number: { $default: 4 },
    },
    handlers
  )
  await setWalker(
    schema,
    {
      $id: 'bl1',
      integer: { $default: 4 },
    },
    handlers
  )
  await setWalker(
    schema,
    {
      $id: 'bl1',
      exclusiveminmax: { $default: 4 },
    },
    handlers
  )
  await setWalker(
    schema,
    {
      $id: 'bl1',
      multipleOf: { $default: 6 },
    },
    handlers
  )

  t.deepEqual(results, [
    { path: ['number'], value: { $default: 4 } },
    { path: ['integer'], value: { $default: 4 } },
    { path: ['exclusiveminmax'], value: { $default: 4 } },
    { path: ['multipleOf'], value: { $default: 6 } },
  ])
})

test('decrement', async (t) => {
  const { handlers, results } = createHandlers()
  //maxmin
  await t.throwsAsync(
    setWalker(
      schema,
      {
        $id: 'bl1',
        number: { $decrement: 2 },
      },
      handlers
    )
  )
  await t.throwsAsync(
    setWalker(
      schema,
      {
        $id: 'bl1',
        number: { $decrement: 7 },
      },
      handlers
    )
  )

  await setWalker(
    schema,
    {
      $id: 'bl1',
      number: { $decrement: 3 },
    },
    handlers
  )
  //exclusiveminmax
  await t.throwsAsync(
    setWalker(
      schema,
      {
        $id: 'bl1',
        exclusiveminmax: { $decrement: 3 },
      },
      handlers
    )
  )
  await t.throwsAsync(
    setWalker(
      schema,
      {
        $id: 'bl1',
        exclusiveminmax: { $decrement: 6 },
      },
      handlers
    )
  )

  await setWalker(
    schema,
    {
      $id: 'bl1',
      exclusiveminmax: { $decrement: 4 },
    },
    handlers
  )

  //integer
  await t.throwsAsync(
    setWalker(
      schema,
      {
        $id: 'bl1',
        integer: { $decrement: 3.5 },
      },
      handlers
    )
  )

  await setWalker(
    schema,
    {
      $id: 'bl1',
      integer: { $decrement: 3 },
    },
    handlers
  )
  //multiple of

  await t.throwsAsync(
    setWalker(
      schema,
      {
        $id: 'bl1',
        multipleOf: { $decrement: 7 },
      },
      handlers
    )
  )

  await setWalker(
    schema,
    {
      $id: 'bl1',
      multipleOf: { $decrement: 9 },
    },
    handlers
  )
  t.deepEqual(results, [
    { path: ['number'], value: { $decrement: 3 } },
    { path: ['exclusiveminmax'], value: { $decrement: 4 } },
    { path: ['integer'], value: { $decrement: 3 } },
    { path: ['multipleOf'], value: { $decrement: 9 } },
  ])
})

test('increment', async (t) => {
  const { handlers, results } = createHandlers()
  //maxmin
  await t.throwsAsync(
    setWalker(
      schema,
      {
        $id: 'bl1',
        number: { $increment: 2 },
      },
      handlers
    )
  )
  await t.throwsAsync(
    setWalker(
      schema,
      {
        $id: 'bl1',
        number: { $increment: 7 },
      },
      handlers
    )
  )

  await setWalker(
    schema,
    {
      $id: 'bl1',
      number: { $increment: 3 },
    },
    handlers
  )
  //exclusiveminmax
  await t.throwsAsync(
    setWalker(
      schema,
      {
        $id: 'bl1',
        exclusiveminmax: { $increment: 3 },
      },
      handlers
    )
  )
  await t.throwsAsync(
    setWalker(
      schema,
      {
        $id: 'bl1',
        exclusiveminmax: { $increment: 6 },
      },
      handlers
    )
  )

  await setWalker(
    schema,
    {
      $id: 'bl1',
      exclusiveminmax: { $increment: 4 },
    },
    handlers
  )

  //integer
  await t.throwsAsync(
    setWalker(
      schema,
      {
        $id: 'bl1',
        integer: { $increment: 3.5 },
      },
      handlers
    )
  )

  await setWalker(
    schema,
    {
      $id: 'bl1',
      integer: { $increment: 3 },
    },
    handlers
  )
  //multiple of

  await t.throwsAsync(
    setWalker(
      schema,
      {
        $id: 'bl1',
        multipleOf: { $increment: 7 },
      },
      handlers
    )
  )

  await setWalker(
    schema,
    {
      $id: 'bl1',
      multipleOf: { $increment: 9 },
    },
    handlers
  )
  t.deepEqual(results, [
    { path: ['number'], value: { $increment: 3 } },
    { path: ['exclusiveminmax'], value: { $increment: 4 } },
    { path: ['integer'], value: { $increment: 3 } },
    { path: ['multipleOf'], value: { $increment: 9 } },
  ])
})
