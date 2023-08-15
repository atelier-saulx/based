import test from 'ava'
import { BasedSchema, setWalker } from '../src/index'
import { errorCollect, resultCollect } from './utils'
import { deepEqual } from '@saulx/utils'

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
        complexObj: {
          type: 'object',
          properties: {
            bool: { type: 'boolean' },
            string: { type: 'string', maxLength: 6 },
            objArray: {
              type: 'array',
              values: {
                type: 'object',
                properties: {
                  snurp: {
                    type: 'string',
                  },
                },
              },
            },
            intArray: {
              type: 'array',
              values: {
                type: 'integer',
              },
            },
          },
        },
        moreComplexObj: {
          type: 'object',
          properties: {
            bool: { type: 'boolean' },
            string: { type: 'string', maxLength: 6 },
            objArray: {
              type: 'array',
              values: {
                type: 'object',
                properties: {
                  bool: { type: 'boolean' },
                  string: { type: 'string', maxLength: 6 },
                  objArray: {
                    type: 'array',
                    values: {
                      type: 'object',
                      properties: {
                        snurp: {
                          type: 'string',
                        },
                      },
                    },
                  },
                  intArray: {
                    type: 'array',
                    values: {
                      type: 'integer',
                    },
                  },
                },
              },
            },
            intArray: {
              type: 'array',
              values: {
                type: 'integer',
              },
            },
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
  languages: ['en', 'de', 'nl', 'ro', 'za', 'ae'],
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

test('object: some nested stuff', async (t) => {
  r = await setWalker(schema, {
    $id: 'bl1',
    complexObj: {
      bool: true,
      string: '12345',
      objArray: [{ snurp: 'a' }, { snurp: 'b' }, { snurp: 'c' }],
      intArray: [1, 2, 3, 4, 5],
    },
  })

  t.true(r.errors.length === 0)
})

test('object: big', async (t) => {
  r = await setWalker(schema, {
    $id: 'bl1',
    complexObj: {
      bool: { $default: true },
      string: { $default: '12345' },
      objArray: {
        $assign: {
          $idx: 3,
          $value: {
            snurp: {
              $delete: true,
            },
          },
        },
      },
      intArray: { $push: [1, 2, 3, 4, 5] },
    },
  })

  t.true(r.errors.length === 0)
})

//TODO is this wrong?
test('object: more big', async (t) => {
  r = await setWalker(schema, {
    $id: 'bl1',
    complexObj: {
      bool: { $default: true },
      string: { $default: '12345' },
      objArray: {
        $assign: {
          $idx: 3,
          $value: {
            snurp: {
              $delete: true,
            },
          },
        },
      },
      intarray: {
        $insert: {
          $idx: 10,
          $value: 1212,
        },
      },
    },
  })

  t.true(r.errors.length === 0)
})

test('moreComplexObj', async (t) => {
  r = await setWalker(schema, {
    $id: 'bl1',
    moreComplexObj: {
      bool: true,
      string: '12345',
      objArray: [
        {
          bool: true,
          string: '12345',
          objArray: [{ snurp: 'a' }, { snurp: 'b' }, { snurp: 'c' }],
          intArray: [1, 2, 3, 4, 5],
        },
        {
          bool: true,
          string: '12345',
          objArray: [{ snurp: 'a' }, { snurp: 'b' }, { snurp: 'c' }],
          intArray: [1, 2, 3, 4, 5],
        },
        {
          bool: true,
          string: '12345',
          objArray: [{ snurp: 'a' }, { snurp: 'b' }, { snurp: 'c' }],
          intArray: [1, 2, 3, 4, 5],
        },
      ],
      intArray: [1, 2, 3, 4, 5],
    },
  })

  t.true(r.errors.length === 0)
  t.deepEqual(moreComplexObj1, resultCollect(r))
})

test('moreComplexObj thibngytt', async (t) => {
  r = await setWalker(schema, {
    $id: 'bl1',
    moreComplexObj: {
      bool: true,
      string: '12345',
      objArray: {
        $assign: {
          $idx: 3,
          $value: {
            bool: {
              $delete: true,
            },
          },
        },
      },
      intArray: [1, 2, 3, 4, 5],
    },
  })

  t.deepEqual(moreComplexObj2, resultCollect(r))
  t.true(r.errors.length === 0)
})

const moreComplexObj1 = [
  { path: ['moreComplexObj', 'bool'], value: true },
  { path: ['moreComplexObj', 'string'], value: '12345' },
  {
    path: ['moreComplexObj', 'objArray'],
    value: { $delete: true },
  },
  {
    path: ['moreComplexObj', 'intArray'],
    value: { $delete: true },
  },
  { path: ['moreComplexObj', 'intArray', 0], value: 1 },
  { path: ['moreComplexObj', 'intArray', 1], value: 2 },
  { path: ['moreComplexObj', 'intArray', 2], value: 3 },
  { path: ['moreComplexObj', 'intArray', 3], value: 4 },
  { path: ['moreComplexObj', 'intArray', 4], value: 5 },
  { path: ['moreComplexObj', 'objArray', 0, 'bool'], value: true },
  {
    path: ['moreComplexObj', 'objArray', 0, 'string'],
    value: '12345',
  },
  { path: ['moreComplexObj', 'objArray', 1, 'bool'], value: true },
  {
    path: ['moreComplexObj', 'objArray', 1, 'string'],
    value: '12345',
  },
  { path: ['moreComplexObj', 'objArray', 2, 'bool'], value: true },
  {
    path: ['moreComplexObj', 'objArray', 2, 'string'],
    value: '12345',
  },
  {
    path: ['moreComplexObj', 'objArray', 0, 'objArray'],
    value: { $delete: true },
  },
  {
    path: ['moreComplexObj', 'objArray', 0, 'intArray'],
    value: { $delete: true },
  },
  {
    path: ['moreComplexObj', 'objArray', 0, 'intArray', 0],
    value: 1,
  },
  {
    path: ['moreComplexObj', 'objArray', 0, 'intArray', 1],
    value: 2,
  },
  {
    path: ['moreComplexObj', 'objArray', 0, 'intArray', 2],
    value: 3,
  },
  {
    path: ['moreComplexObj', 'objArray', 0, 'intArray', 3],
    value: 4,
  },
  {
    path: ['moreComplexObj', 'objArray', 0, 'intArray', 4],
    value: 5,
  },
  {
    path: ['moreComplexObj', 'objArray', 1, 'objArray'],
    value: { $delete: true },
  },
  {
    path: ['moreComplexObj', 'objArray', 1, 'intArray'],
    value: { $delete: true },
  },
  {
    path: ['moreComplexObj', 'objArray', 1, 'intArray', 0],
    value: 1,
  },
  {
    path: ['moreComplexObj', 'objArray', 1, 'intArray', 1],
    value: 2,
  },
  {
    path: ['moreComplexObj', 'objArray', 1, 'intArray', 2],
    value: 3,
  },
  {
    path: ['moreComplexObj', 'objArray', 1, 'intArray', 3],
    value: 4,
  },
  {
    path: ['moreComplexObj', 'objArray', 1, 'intArray', 4],
    value: 5,
  },
  {
    path: ['moreComplexObj', 'objArray', 2, 'objArray'],
    value: { $delete: true },
  },
  {
    path: ['moreComplexObj', 'objArray', 2, 'intArray'],
    value: { $delete: true },
  },
  {
    path: ['moreComplexObj', 'objArray', 2, 'intArray', 0],
    value: 1,
  },
  {
    path: ['moreComplexObj', 'objArray', 2, 'intArray', 1],
    value: 2,
  },
  {
    path: ['moreComplexObj', 'objArray', 2, 'intArray', 2],
    value: 3,
  },
  {
    path: ['moreComplexObj', 'objArray', 2, 'intArray', 3],
    value: 4,
  },
  {
    path: ['moreComplexObj', 'objArray', 2, 'intArray', 4],
    value: 5,
  },
  {
    path: ['moreComplexObj', 'objArray', 0, 'objArray', 0, 'snurp'],
    value: 'a',
  },
  {
    path: ['moreComplexObj', 'objArray', 0, 'objArray', 1, 'snurp'],
    value: 'b',
  },
  {
    path: ['moreComplexObj', 'objArray', 0, 'objArray', 2, 'snurp'],
    value: 'c',
  },
  {
    path: ['moreComplexObj', 'objArray', 1, 'objArray', 0, 'snurp'],
    value: 'a',
  },
  {
    path: ['moreComplexObj', 'objArray', 1, 'objArray', 1, 'snurp'],
    value: 'b',
  },
  {
    path: ['moreComplexObj', 'objArray', 1, 'objArray', 2, 'snurp'],
    value: 'c',
  },
  {
    path: ['moreComplexObj', 'objArray', 2, 'objArray', 0, 'snurp'],
    value: 'a',
  },
  {
    path: ['moreComplexObj', 'objArray', 2, 'objArray', 1, 'snurp'],
    value: 'b',
  },
  {
    path: ['moreComplexObj', 'objArray', 2, 'objArray', 2, 'snurp'],
    value: 'c',
  },
  {
    path: ['moreComplexObj', 'objArray', 0, 'objArray', 0],
    value: { snurp: 'a' },
  },
  {
    path: ['moreComplexObj', 'objArray', 0, 'objArray', 1],
    value: { snurp: 'b' },
  },
  {
    path: ['moreComplexObj', 'objArray', 0, 'objArray', 2],
    value: { snurp: 'c' },
  },
  {
    path: ['moreComplexObj', 'objArray', 1, 'objArray', 0],
    value: { snurp: 'a' },
  },
  {
    path: ['moreComplexObj', 'objArray', 1, 'objArray', 1],
    value: { snurp: 'b' },
  },
  {
    path: ['moreComplexObj', 'objArray', 1, 'objArray', 2],
    value: { snurp: 'c' },
  },
  {
    path: ['moreComplexObj', 'objArray', 2, 'objArray', 0],
    value: { snurp: 'a' },
  },
  {
    path: ['moreComplexObj', 'objArray', 2, 'objArray', 1],
    value: { snurp: 'b' },
  },
  {
    path: ['moreComplexObj', 'objArray', 2, 'objArray', 2],
    value: { snurp: 'c' },
  },
  {
    path: ['moreComplexObj', 'objArray', 0],
    value: {
      bool: true,
      string: '12345',
      objArray: [{ snurp: 'a' }, { snurp: 'b' }, { snurp: 'c' }],
      intArray: [1, 2, 3, 4, 5],
    },
  },
  {
    path: ['moreComplexObj', 'objArray', 1],
    value: {
      bool: true,
      string: '12345',
      objArray: [{ snurp: 'a' }, { snurp: 'b' }, { snurp: 'c' }],
      intArray: [1, 2, 3, 4, 5],
    },
  },
  {
    path: ['moreComplexObj', 'objArray', 2],
    value: {
      bool: true,
      string: '12345',
      objArray: [{ snurp: 'a' }, { snurp: 'b' }, { snurp: 'c' }],
      intArray: [1, 2, 3, 4, 5],
    },
  },
  {
    path: ['moreComplexObj'],
    value: {
      bool: true,
      string: '12345',
      objArray: [
        {
          bool: true,
          string: '12345',
          objArray: [{ snurp: 'a' }, { snurp: 'b' }, { snurp: 'c' }],
          intArray: [1, 2, 3, 4, 5],
        },
        {
          bool: true,
          string: '12345',
          objArray: [{ snurp: 'a' }, { snurp: 'b' }, { snurp: 'c' }],
          intArray: [1, 2, 3, 4, 5],
        },
        {
          bool: true,
          string: '12345',
          objArray: [{ snurp: 'a' }, { snurp: 'b' }, { snurp: 'c' }],
          intArray: [1, 2, 3, 4, 5],
        },
      ],
      intArray: [1, 2, 3, 4, 5],
    },
  },
]

const moreComplexObj2 = [
  { path: ['moreComplexObj', 'bool'], value: true },
  { path: ['moreComplexObj', 'string'], value: '12345' },
  {
    path: ['moreComplexObj', 'intArray'],
    value: { $delete: true },
  },
  { path: ['moreComplexObj', 'intArray', 0], value: 1 },
  { path: ['moreComplexObj', 'intArray', 1], value: 2 },
  { path: ['moreComplexObj', 'intArray', 2], value: 3 },
  { path: ['moreComplexObj', 'intArray', 3], value: 4 },
  { path: ['moreComplexObj', 'intArray', 4], value: 5 },
  {
    path: ['moreComplexObj', 'objArray', 3, 'bool'],
    value: { $delete: true },
  },
  {
    path: ['moreComplexObj', 'objArray', 3],
    value: { bool: { $delete: true } },
  },
  {
    path: ['moreComplexObj'],
    value: {
      bool: true,
      string: '12345',
      objArray: {
        $assign: { $idx: 3, $value: { bool: { $delete: true } } },
      },
      intArray: [1, 2, 3, 4, 5],
    },
  },
]
