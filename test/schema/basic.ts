import test from '../shared/test.js'
import { parse } from '@based/sdk'

await test('basic', async () => {
  parse({
    locales: {
      en: {},
    },
    types: {
      user: {
        props: {
          string: { type: 'string' },
          number: { type: 'number' },
          binary: { type: 'binary' },
          boolean: { type: 'boolean' },
          timestamp: { type: 'timestamp' },
          enum: { type: 'enum', enum: ['foo', 'bar', 'baz'] },
          text: { type: 'text' },
          object: {
            type: 'object',
            props: {
              foo: { type: 'string' },
            },
          },
          reference: { type: 'reference', ref: 'file', prop: 'referenceFor' },
          references: {
            type: 'references',
            items: { ref: 'file', prop: 'referencesFor' },
          },
        },
      },
      file: {
        props: {
          src: { type: 'string' },
          referenceFor: { type: 'reference', ref: 'user', prop: 'reference' },
          referencesFor: { type: 'reference', ref: 'user', prop: 'references' },
        },
      },
    },
  })
})
