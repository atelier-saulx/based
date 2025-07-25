import test from 'node:test'
import { deepEqual } from 'node:assert'
import { parse } from '@based/schema'

await test('shorthands', () => {
  deepEqual(
    parse({
      types: {
        hello: {
          props: {
            myText: 'text',
            myString: 'string',
            myNumber: 'number',
            myEnum: [1, 2, 3],
          },
        },
      },
      props: {
        myText: 'text',
      },
    }).schema,
    {
      types: {
        hello: {
          props: {
            myText: { type: 'text' },
            myString: { type: 'string' },
            myNumber: { type: 'number' },
            myEnum: { enum: [1, 2, 3] },
          },
        },
      },
      props: {
        myText: { type: 'text' },
      },
    },
  )

  deepEqual(
    parse({
      types: {
        article: {
          header: 'text',
          body: 'string',
          views: 'number',
        },
      },
    }).schema,
    {
      types: {
        article: {
          props: {
            header: {
              type: 'text',
            },
            body: {
              type: 'string',
            },
            views: {
              type: 'number',
            },
          },
        },
      },
    },
  )

  deepEqual(
    parse({
      types: {
        article: {
          header: 'text',
          body: 'string',
          views: 'number',
        },
      },
    }).schema,
    {
      types: {
        article: {
          props: {
            header: {
              type: 'text',
            },
            body: {
              type: 'string',
            },
            views: {
              type: 'number',
            },
          },
        },
      },
    },
  )
})
