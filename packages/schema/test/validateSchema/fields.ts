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
