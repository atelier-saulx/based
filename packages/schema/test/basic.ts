import test from 'node:test'
import { parse } from '@based/schema'

await test('basic', () => {
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
          set: { type: 'set', items: { type: 'string' } },
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
