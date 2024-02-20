import test from 'ava'
import {
  pathToQuery,
  getValueByPath,
  getSchemaTypeFieldByPath,
} from '../src/util/index.js'
import { BasedSchemaTypePartial } from '@based/schema'

test('pathToQuery should create an object structure out of a path', (t) => {
  t.deepEqual(pathToQuery(['level1', 'level2', 'level3', 'level4'], true), {
    level1: {
      level2: {
        level3: {
          level4: true,
        },
      },
    },
  })
})

test('getValueByPath', (t) => {
  t.is(
    getValueByPath(
      {
        level1: 123,
      },
      ['level1']
    ),
    123
  )
  t.is(
    getValueByPath(
      {
        level1: 123,
      },
      'level1'
    ),
    123
  )

  t.is(
    getValueByPath(
      {
        level1: {
          level2: {
            level3: {
              level4: 456,
            },
          },
        },
      },
      ['level1', 'level2', 'level3', 'level4']
    ),
    456
  )
  t.is(
    getValueByPath(
      {
        level1: {
          level2: {
            level3: {
              level4: 456,
            },
          },
        },
      },
      'level1.level2.level3.level4'
    ),
    456
  )

  t.deepEqual(
    getValueByPath(
      {
        level1: {
          level2: {
            level3: {
              level4: 456,
            },
          },
        },
      },
      ['level1', 'level2']
    ),
    { level3: { level4: 456 } }
  )

  t.deepEqual(getValueByPath(undefined, undefined), undefined)
  t.deepEqual(getValueByPath(undefined, ['nonExisting']), undefined)
  t.deepEqual(
    getValueByPath({ level1: { level2: 123 } }, ['nonExisting', 'none']),
    undefined
  )
  t.deepEqual(getValueByPath({}, ['nonExisting', 'none']), undefined)
})

test('getSchemaTypeFieldByPath', (t) => {
  t.deepEqual(
    getSchemaTypeFieldByPath(
      {
        fields: {
          level1: {
            type: 'string',
          },
        },
      },
      ['level1']
    ),
    { type: 'string' }
  )
  t.deepEqual(
    getSchemaTypeFieldByPath(
      {
        fields: {
          level1: {
            type: 'object',
            properties: {
              level2: {
                type: 'object',
                properties: {
                  level3: { type: 'number' },
                },
              },
            },
          },
        },
      },
      ['level1', 'level2', 'level3']
    ),
    { type: 'number' }
  )

  t.deepEqual(getSchemaTypeFieldByPath(undefined, undefined), undefined)
  t.deepEqual(getSchemaTypeFieldByPath(undefined, ['nonExisting']), undefined)
  t.deepEqual(
    getSchemaTypeFieldByPath(
      {
        fields: {
          level1: {
            type: 'object',
            properties: {
              level2: { type: 'number' },
            },
          },
        },
      },
      ['nonExisting', 'none']
    ),
    undefined
  )
  t.deepEqual(getValueByPath({}, ['nonExisting', 'none']), undefined)

  const schema: BasedSchemaTypePartial = {
    fields: {
      level1: {
        type: 'string',
      },
    },
  }
  t.true(getSchemaTypeFieldByPath(schema, ['level1']) === schema.fields?.level1)
})

test('getSchemaTypeFieldByPath on recordsith object values', (t) => {
  t.deepEqual(
    getSchemaTypeFieldByPath(
      {
        fields: {
          level1: {
            type: 'record',
            values: {
              type: 'object',
              properties: {
                level2: { type: 'string' },
              },
            },
          },
        },
      },
      ['level1', 'level2']
    ),
    { type: 'string' }
  )

  t.deepEqual(
    getSchemaTypeFieldByPath(
      {
        fields: {
          level1: {
            type: 'record',
            values: {
              type: 'object',
              properties: {
                level2: {
                  type: 'object',
                  properties: {
                    level3: {
                      type: 'object',
                      properties: {
                        level4: { type: 'string' },
                      },
                    },
                  },
                },
              },
            },
          },
        },
      },
      ['level1', 'level2', 'level3', 'level4']
    ),
    { type: 'string' }
  )
})
