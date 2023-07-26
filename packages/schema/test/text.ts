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
          type: 'text',
        },
      },
    },
  },
  $defs: {},
  languages: ['en', 'de'],
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
      console.log('collect', path)
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

test('text max length', async (t) => {
  const { handlers, results } = createHandlers()
  await t.throwsAsync(
    setWalker(
      schema,
      {
        $id: 'bl1',
        name: {
          de: 'ax',
          nl: 'axa',
        },
      },
      handlers
    )
  )
  await t.throwsAsync(
    setWalker(
      schema,
      {
        $id: 'bl1',
        $language: 'de',
        name: 'axaxaxax',
      },
      handlers
    )
  )
  await setWalker(
    schema,
    {
      $id: 'bl1',
      $language: 'en',
      name: 'xaxx',
    },
    handlers
  )
  t.deepEqual(results, [{ path: ['name'], value: { en: 'xaxx' } }])
})

test('text wrong language', async (t) => {
  const { handlers, results } = createHandlers()
  await t.throwsAsync(
    setWalker(
      schema,
      {
        $id: 'bl1',
        name: {
          de: 'xaxx',
          nl: 'xaxx',
          es: 'flap',
        },
      },
      handlers
    )
  )

  await setWalker(
    schema,
    {
      $id: 'bl1',
      $language: 'de',
      name: 'blabla',
    },
    handlers
  )

  //TODO fix
  t.deepEqual(results, [
    { path: ['name', 'de'], value: 'blabla' },
    { path: ['name'], value: { de: 'blabla' } },
  ])
})

test('default', async (t) => {
  const { handlers, results } = createHandlers()
  await setWalker(
    schema,
    {
      $id: 'bl1',
      $language: 'de',
      name: { $default: 'xaxx' },
    },
    handlers
  )
  await setWalker(
    schema,
    {
      $id: 'bl1',
      $language: 'de',
      name: { de: { $default: 'xaxx' } },
    },
    handlers
  )
  t.deepEqual(results, [
    { path: ['name'], value: { de: { $default: 'xaxx' } } },
    { path: ['name'], value: { de: { $default: 'xaxx' } } },
  ])
})

test('value', async (t) => {
  const { handlers, results } = createHandlers()
  await t.throwsAsync(
    setWalker(
      schema,
      {
        $id: 'bl1',
        $language: 'de',
        name: { $value: 'xaxx' },
      },
      handlers
    )
  )
  t.deepEqual(results, [])

  await setWalker(
    schema,
    {
      $id: 'bl1',
      $language: 'de',
      name: { de: { $value: 'xaxx' } },
    },
    handlers
  )
  console.log('-------------->', results)
  t.deepEqual(results, [{ path: ['name', 'de'], value: { $value: 'xaxx' } }])
})
