import test from 'ava'
import { BasedSchema, setWalker, BasedSetHandlers } from '../src/index'

const schema: BasedSchema = {
  types: {
    bla: {
      prefix: 'bl',
      fields: {
        name: {
          minLength: 3,
          maxLength: 6,
          type: 'string',
        },
        phonkName: {
          type: 'string',
          pattern: '\\${1,4}',
        },
        bla: {
          type: 'set',
          items: { type: 'string', minLength: 3, maxLength: 6 },
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

test('string max length', async (t) => {
  const { handlers, results } = createHandlers()
  await t.throwsAsync(
    setWalker(
      schema,
      {
        $id: 'bl1',
        name: 'ax',
      },
      handlers
    )
  )
  await t.throwsAsync(
    setWalker(
      schema,
      {
        $id: 'bl1',
        name: 'axaxaxax',
      },
      handlers
    )
  )
  await setWalker(
    schema,
    {
      $id: 'bl1',
      name: 'xaxx',
    },
    handlers
  )
  t.deepEqual(results, [{ path: ['name'], value: 'xaxx' }])
})

test('set with strings', async (t) => {
  const { handlers, results } = createHandlers()
  await t.throwsAsync(
    setWalker(
      schema,
      {
        $id: 'bl1',
        bla: ['ax', 'axa', 'axxxxa'],
      },
      handlers
    )
  )
  t.deepEqual(results, [])
  await setWalker(
    schema,
    {
      $id: 'bl1',
      bla: ['axx', 'axxxx', 'blaaa'],
    },
    handlers
  )
  t.deepEqual(results, [
    { path: ['bla'], value: { $value: ['axx', 'axxxx', 'blaaa'] } },
  ])
})

test('string pattern', async (t) => {
  const { handlers, results } = createHandlers()
  await t.throwsAsync(
    setWalker(
      schema,
      {
        $id: 'bl1',
        phonkName: 'blabla',
      },
      handlers
    )
  )
  t.deepEqual(results, [])
  await setWalker(
    schema,
    {
      $id: 'bl1',
      phonkName: 'bla$',
    },
    handlers
  )
  t.deepEqual(results, [{ path: ['phonkName'], value: 'bla$' }])
})

test('setting $default', async (t) => {
  const { handlers, results } = createHandlers()
  await t.throwsAsync(
    setWalker(
      schema,
      {
        $id: 'bl1',
        phonkName: { $default: 'blabla' },
      },
      handlers
    )
  )
  t.deepEqual(results, [])
  await setWalker(
    schema,
    {
      $id: 'bl1',
      phonkName: { $default: 'bla$' },
    },
    handlers
  )
  t.deepEqual(results, [{ path: ['phonkName'], value: { $default: 'bla$' } }])
})

test('setting $value', async (t) => {
  const { handlers, results } = createHandlers()
  await t.throwsAsync(
    setWalker(
      schema,
      {
        $id: 'bl1',
        phonkName: { $value: 'blabla' },
      },
      handlers
    )
  )
  t.deepEqual(results, [])
  await setWalker(
    schema,
    {
      $id: 'bl1',
      phonkName: { $value: 'bla$' },
    },
    handlers
  )
  t.deepEqual(results, [{ path: ['phonkName'], value: { $value: 'bla$' } }])
})
