import { deepEqual, test } from '../../shared/index.js'
import { parse } from '@based/sdk'

await test('shorthands', async () => {
  deepEqual(
    parse({
      locales: ['en'],
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
      hash: 8197646311213,
      locales: { en: { fallback: [] } },
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
      hash: 13989456573687,
      locales: { en: { fallback: [] } },
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
      hash: 13989456573687,
      locales: { en: { fallback: [] } },
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
