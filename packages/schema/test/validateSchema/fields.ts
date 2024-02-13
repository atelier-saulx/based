import anyTest, { TestFn } from 'ava'
import { validateSchema } from '../../src/validateSchema/index.js'
import { ParseError } from '../../src/error.js'

const test = anyTest as TestFn<{}>

test('shared', async (t) => {
  t.deepEqual(
    await validateSchema({
      root: {
        fields: {
          stringField: {
            type: 'string',
            // @ts-ignore
            wawa: true,
          },
        },
      },
    }),
    {
      errors: [
        {
          code: ParseError.invalidProperty,
          path: ['root', 'fields', 'stringField', 'wawa'],
        },
      ],
    },
    'invalid property'
  )

  t.deepEqual(
    await validateSchema({
      root: {
        fields: {
          stringField: {
            type: 'string',
            hooks: { hook: 'aHook' },
          },
        },
      },
    }),
    {
      valid: true,
    }
  )
  t.deepEqual(
    await validateSchema({
      root: {
        fields: {
          stringField: {
            type: 'string',
            hooks: [
              { hook: 'aHook', interval: 1000 },
              { hook: 'anotherHook', interval: 2000 },
            ],
          },
        },
      },
    }),
    {
      valid: true,
    }
  )
  t.deepEqual(
    await validateSchema({
      root: {
        fields: {
          stringField: {
            type: 'string',
            // @ts-ignore
            hooks: true,
          },
        },
      },
    }),
    {
      errors: [
        {
          code: ParseError.incorrectFormat,
          path: ['root', 'fields', 'stringField', 'hooks'],
        },
      ],
    },
    'hooks format is wrong'
  )
  t.deepEqual(
    await validateSchema({
      root: {
        fields: {
          stringField: {
            type: 'string',
            // @ts-ignore
            hooks: {
              hook: 'aHook',
              // @ts-ignore
              interval: '2000',
            },
          },
        },
      },
    }),
    {
      errors: [
        {
          code: ParseError.incorrectFormat,
          path: ['root', 'fields', 'stringField', 'hooks', 'interval'],
        },
      ],
    },
    'hooks format is wrong'
  )
  t.deepEqual(
    await validateSchema({
      root: {
        fields: {
          stringField: {
            type: 'string',
            // @ts-ignore
            hooks: [
              { hook: 'aHook', interval: 1000 },
              // @ts-ignore
              { hook: 'anotherHook', interval: '2000' },
            ],
          },
        },
      },
    }),
    {
      errors: [
        {
          code: ParseError.incorrectFormat,
          path: ['root', 'fields', 'stringField', 'hooks', '1', 'interval'],
        },
      ],
    },
    'hooks format is wrong'
  )
})

test('string', async (t) => {
  t.deepEqual(
    await validateSchema({
      root: {
        fields: {
          stringField: {
            type: 'string',
          },
        },
      },
    }),
    {
      valid: true,
    }
  )
  t.deepEqual(
    await validateSchema({
      types: {
        aType: {
          fields: {
            stringField: {
              type: 'string',
            },
          },
        },
      },
    }),
    {
      valid: true,
    }
  )

  t.deepEqual(
    await validateSchema({
      root: {
        fields: {
          stringField: {
            type: 'string',
            // @ts-ignore
            values: {
              type: 'string',
            },
          },
        },
      },
    }),
    {
      errors: [
        {
          code: ParseError.invalidProperty,
          path: ['root', 'fields', 'stringField', 'values'],
        },
      ],
    }
  )
  t.deepEqual(
    await validateSchema({
      types: {
        aType: {
          fields: {
            stringField: {
              type: 'string',
              // @ts-ignore
              values: {
                type: 'string',
              },
            },
          },
        },
      },
    }),
    {
      errors: [
        {
          code: ParseError.invalidProperty,
          path: ['types', 'aType', 'fields', 'stringField', 'values'],
        },
      ],
    }
  )
})

test('objects', async (t) => {
  t.deepEqual(
    await validateSchema({
      root: {
        fields: {
          objectField: {
            type: 'object',
            properties: {
              aStringField: {
                type: 'string',
              },
            },
          },
        },
      },
    }),
    {
      valid: true,
    }
  )

  t.deepEqual(
    await validateSchema({
      root: {
        fields: {
          objectField: {
            type: 'object',
            properties: {
              aStringField: {
                // @ts-ignore
                wawa: true,
              },
            },
          },
        },
      },
    }),
    {
      errors: [
        {
          code: ParseError.invalidProperty,
          path: [
            'root',
            'fields',
            'objectField',
            'properties',
            'aStringField',
            'wawa',
          ],
        },
      ],
    }
  )

  t.deepEqual(
    await validateSchema({
      root: {
        fields: {
          objectField: {
            type: 'object',
            properties: {
              anotherObjectField: {
                type: 'object',
                properties: {
                  aWrongObjectField: {
                    type: 'object',
                    // @ts-ignore
                    values: { type: 'string' },
                  },
                },
              },
            },
          },
        },
      },
    }),
    {
      errors: [
        {
          code: ParseError.invalidProperty,
          path: [
            'root',
            'fields',
            'objectField',
            'properties',
            'anotherObjectField',
            'properties',
            'aWrongObjectField',
            'values',
          ],
        },
      ],
    }
  )
})

test('records', async (t) => {
  t.deepEqual(
    await validateSchema({
      root: {
        fields: {
          recordField: {
            type: 'record',
            values: {
              type: 'string',
            },
          },
        },
      },
    }),
    {
      valid: true,
    }
  )

  t.deepEqual(
    await validateSchema({
      root: {
        fields: {
          recordField: {
            type: 'record',
            values: {
              type: 'object',
              properties: {
                aWrongObjectField: {
                  type: 'object',
                  // @ts-ignore
                  values: { type: 'string' },
                },
              },
            },
          },
        },
      },
    }),
    {
      errors: [
        {
          code: ParseError.invalidProperty,
          path: [
            'root',
            'fields',
            'recordField',
            'values',
            'properties',
            'aWrongObjectField',
            'values',
          ],
        },
      ],
    }
  )
})

test('arrays', async (t) => {
  t.deepEqual(
    await validateSchema({
      root: {
        fields: {
          arrayField: {
            type: 'array',
            values: {
              type: 'string',
            },
          },
        },
      },
    }),
    {
      valid: true,
    }
  )

  t.deepEqual(
    await validateSchema({
      root: {
        fields: {
          arrayField: {
            type: 'array',
            values: {
              type: 'object',
              properties: {
                aWrongObjectField: {
                  type: 'object',
                  // @ts-ignore
                  values: { type: 'string' },
                },
              },
            },
          },
        },
      },
    }),
    {
      errors: [
        {
          code: ParseError.invalidProperty,
          path: [
            'root',
            'fields',
            'arrayField',
            'values',
            'properties',
            'aWrongObjectField',
            'values',
          ],
        },
      ],
    }
  )
})

test('enum', async (t) => {
  t.deepEqual(
    await validateSchema({
      root: {
        fields: {
          enumField: {
            enum: ['one', 'two'],
          },
        },
      },
    }),
    {
      valid: true,
    }
  )

  t.deepEqual(
    await validateSchema({
      root: {
        fields: {
          enumField: {
            enum: [1, 2],
          },
        },
      },
    }),
    {
      valid: true,
    }
  )

  t.deepEqual(
    await validateSchema({
      root: {
        fields: {
          enumField: {
            enum: [{ one: 'one' }, { two: 'two' }],
          },
        },
      },
    }),
    {
      valid: true,
    }
  )

  t.deepEqual(
    await validateSchema({
      root: {
        fields: {
          enumField: {
            // @ts-ignore
            enum: 'invalidEnum',
          },
        },
      },
    }),
    {
      errors: [
        {
          code: ParseError.incorrectFormat,
          path: ['root', 'fields', 'enumField', 'enum'],
        },
      ],
    }
  )

  t.deepEqual(
    await validateSchema({
      root: {
        fields: {
          enumField: {
            enum: ['one', 'two'],
            // @ts-ignore
            invalidProperty: 'invalid',
          },
        },
      },
    }),
    {
      errors: [
        {
          code: ParseError.invalidProperty,
          path: ['root', 'fields', 'enumField', 'invalidProperty'],
        },
      ],
    }
  )
})
