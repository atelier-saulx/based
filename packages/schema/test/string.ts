import test from 'ava'
import { BasedSchema, setWalker, BasedSetHandlers } from '../src/index'

const schema: BasedSchema = {
  types: {
    bla: {
      prefix: 'bl',
      fields: {
        name: {
          minLength: 3,
          type: 'string',
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

test.serial('string max length', async (t) => {
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
  await setWalker(
    schema,
    {
      $id: 'bl1',
      name: 'xax',
    },
    handlers
  )
  t.deepEqual(results, [{ path: ['name'], value: 'xax' }])
})

// test.serial('text', async (t) => {
//   const { handlers } = createHandlers()
//   await t.throwsAsync(
//     setWalker(
//       schema,
//       {
//         $id: 'bl1',
//         name: 'ax',
//       },
//       handlers
//     )
//   )
//   await setWalker(
//     schema,
//     {
//       $id: 'bl1',
//       name: 'xa',
//     },
//     handlers
//   )
// })
