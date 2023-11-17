import test from 'ava'
import {
  pathToQuery,
  getValueByPath,
  getSchemaTypeFieldByPath,
  nonRecursiveWalker,
} from '../src/util'
import { BasedSchemaTypePartial } from '@based/schema'
import { deepEqual } from 'assert'

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
  const obj = { one: 'one', two: { three: 'three' } }
  t.deepEqual(getValueByPath(obj, []), obj)
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

test('non recursive walker', (t) => {
  let result: string[] = []
  const obj = {
    a1: {
      a1b1: {
        a1b1c1: 'a1b1c1',
        a1b1c2: {
          a1b1c2d1: 'a1b1c2d1',
        },
      },
    },
    a2: 'a2',
    a3: {
      a3b1: 'a3b1',
    },
  }
  nonRecursiveWalker(
    obj,
    (target, path, type) => {
      result.push(path.join('.'))
      t.is(getValueByPath(obj, path), target)
      if (path.join('.') === 'a1.a1b1') {
        t.is(type, 1)
      }
      if (path.join('.') === 'a2') {
        t.is(type, 0)
      }
    },
    true
  )
  t.deepEqual(
    result.sort(),
    [
      'a1',
      'a1.a1b1',
      'a1.a1b1.a1b1c1',
      'a1.a1b1.a1b1c2',
      'a1.a1b1.a1b1c2.a1b1c2d1',
      'a2',
      'a3',
      'a3.a3b1',
    ].sort()
  )

  result = []
  nonRecursiveWalker(obj, (_target, path, _type) => {
    result.push(path.join('.'))
  })
  t.deepEqual(
    result.sort(),
    ['a1.a1b1.a1b1c1', 'a1.a1b1.a1b1c2.a1b1c2d1', 'a2', 'a3.a3b1'].sort()
  )

  t.notThrows(() => {
    nonRecursiveWalker(
      {
        a1: 'a1',
        a2: null,
        a3: {
          a3b1: 'a3b1',
          a3b2: {
            a3b2c1: null,
          },
        },
      },
      (_target, _path, _type) => {}
    )
  })
  t.notThrows(() => {
    nonRecursiveWalker({}, (_target, _path, _type) => {
      t.fail()
    })
  })
  t.notThrows(() => {
    nonRecursiveWalker(undefined, (_target, _path, _type) => {
      t.fail()
    })
  })
  t.notThrows(() => {
    nonRecursiveWalker(null, (_target, _path, _type) => {
      t.fail()
    })
  })
  t.notThrows(() => {
    nonRecursiveWalker('string', (_target, _path, _type) => {
      t.fail()
    })
  })
  t.throws(
    () => {
      // @ts-ignore
      nonRecursiveWalker({}, 'string')
    },
    {
      message: 'fn must be a function',
    }
  )
})
