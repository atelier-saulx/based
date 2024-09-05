import test from 'node:test'
import { throws } from 'node:assert'
import { parse } from '@based/schema'

test('set', () => {
  for (const basicType of [
    'string',
    'number',
    'boolean',
    'timestamp',
  ] as const) {
    parse({
      props: {
        myProp: {
          items: {
            type: basicType,
          },
        },
      },
    })

    parse({
      props: {
        myProp: {
          items: {
            type: basicType,
          },
        },
      },
    })
  }

  throws(() => {
    parse({
      types: {
        myType: {
          props: {
            // @ts-ignore
            myProp: {
              type: 'set',
            },
          },
        },
      },
    })
  }, 'Should throw for set without items')
})
