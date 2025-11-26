import test from 'node:test'
import { deepEqual } from 'node:assert'
import { parse } from '@based/schema'

await test('shorthands', () => {
  deepEqual(
    parse({
      locales: { en: {} },
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
    }).schema,
    {
      hash: 1370478657748,
      locales: { en: {} },
      types: {
        hello: {
          props: {
            myText: { type: 'text' },
            myString: { type: 'string' },
            myNumber: { type: 'number' },
            myEnum: { type: 'enum', enum: [1, 2, 3] },
          },
        },
      },
    },
  )

  deepEqual(
    parse({
      locales: { en: {} },
      types: {
        article: {
          header: 'text',
          body: 'string',
          views: 'number',
        },
      },
    }).schema,
    {
      hash: 4322500041486,
      locales: { en: {} },
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
      locales: { en: {} },
      types: {
        article: {
          header: 'text',
          body: 'string',
          views: 'number',
        },
      },
    }).schema,
    {
      hash: 4322500041486,
      locales: { en: {} },
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
