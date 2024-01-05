import test from 'ava'
import { BasedSchema, setWalker } from '../src/index.js'
import { resultCollect } from './utils/index.js'

const schema: BasedSchema = {
  types: {
    thing: {
      prefix: 'ti',
      fields: {
        priority: { type: 'number' },
        something: { type: 'string', format: 'strongPassword' },
      },
    },
    bla: {
      prefix: 'bl',
      fields: {
        enum: {
          enum: ['tony', 'jim'],
        },
        setOfNumbers: {
          type: 'set',
          items: {
            type: 'number',
          },
        },
        object: {
          type: 'object',
          properties: {
            flap: { type: 'boolean' },
          },
        },
        flap: {
          type: 'boolean',
        },
        x: {
          type: 'object',
          properties: {
            flap: {
              type: 'boolean',
            },
          },
        },
        record: {
          type: 'record',
          values: {
            type: 'object',
            properties: {
              bla: {
                type: 'array',
                values: {
                  type: 'object',
                  properties: {
                    snux: {
                      type: 'object',
                      properties: {
                        x: {
                          type: 'number',
                        },
                      },
                    },
                    flap: { type: 'number' },
                  },
                },
              },
            },
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
  language: 'en',
  translations: ['de', 'nl', 'ro', 'za', 'ae'],
  root: {
    fields: {},
  },
  prefixToTypeMapping: {
    bl: 'bla',
    ti: 'thing',
  },
}

let r

test('enum simple', async (t) => {
  r = await setWalker(schema, {
    $id: 'bl120',
    enum: 'tony',
  })

  t.true(r.errors.length === 0)
  t.deepEqual(resultCollect(r), [{ path: ['enum'], value: 0 }])
})

test('enum not exist error', async (t) => {
  r = await setWalker(schema, {
    $id: 'bl120',
    enum: 'kyle',
  })
  t.true(r.errors.length === 1)
})

test('default enum', async (t) => {
  r = await setWalker(schema, {
    $id: 'bl120',
    enum: { $default: 'tony' },
  })
  t.true(r.errors.length === 0)
  t.deepEqual(resultCollect(r), [{ path: ['enum'], value: { $default: 0 } }])
})

test('value enum ', async (t) => {
  r = await setWalker(schema, {
    $id: 'bl120',
    enum: { $value: 'tony' },
  })

  t.true(r.errors.length === 0)
  t.deepEqual(resultCollect(r), [{ path: ['enum'], value: 0 }])
})

test('value &  default enum ', async (t) => {
  r = await setWalker(schema, {
    $id: 'bl120',
    enum: { $default: 'jim', $value: 'tony' },
  })

  t.true(r.errors.length === 2)
})

test('$value & $default enum ', async (t) => {
  r = await setWalker(schema, {
    $id: 'bl120',
    enum: { $value: { $default: 'tony' } },
  })
  t.true(r.errors.length === 0)
  t.deepEqual(resultCollect(r), [{ path: ['enum'], value: { $default: 0 } }])
})

test('default: value enum ', async (t) => {
  r = await setWalker(schema, {
    $id: 'bl120',
    enum: { $default: { $value: 'tony' } },
  })
  t.true(r.errors.length === 0)
  t.deepEqual(resultCollect(r), [{ path: ['enum'], value: { $default: 0 } }])
})

// ask about alias
test('$alias ', async (t) => {
  r = await setWalker(schema, {
    $id: 'bl120',
    $alias: 'bla',
  })

  t.true(r.errors.length === 0)
})

test('$alias array', async (t) => {
  r = await setWalker(schema, {
    $id: 'bl120',
    $alias: ['bla'],
  })

  t.true(r.errors.length === 0)
})

test('object: boolean', async (t) => {
  r = await setWalker(schema, {
    $id: 'bl120',
    object: {
      flap: true,
    },
  })

  t.true(r.errors.length === 0)
  t.deepEqual(resultCollect(r), [
    { path: ['object', 'flap'], value: true },
    { path: ['object'], value: { flap: true } },
  ])
})
