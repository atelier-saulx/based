import test from 'node:test'
import { parse } from '@based/schema'

test('dependency', () => {
  parse({
    locales: {
      en: {},
    },
    types: {
      user: {
        props: {
          string: {
            required: true,
            type: 'string',
          },
          number: {
            required: true,
            type: 'number',
          },
          binary: {
            required: true,
            type: 'binary',
          },
          boolean: {
            required: true,
            type: 'boolean',
          },
          timestamp: {
            required: true,
            type: 'timestamp',
          },
          enum: {
            required: true,
            type: 'enum',
            enum: ['foo', 'bar', 'baz'],
          },
          text: {
            required: true,
            type: 'text',
          },
          set: {
            required: true,
            type: 'set',
            items: { type: 'string' },
          },
          object: {
            required: true,
            type: 'object',
            props: {
              foo: { type: 'string' },
            },
          },
          reference: {
            required: true,
            type: 'reference',
            ref: 'file',
            prop: 'referenceFor',
          },
          references: {
            required: true,
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
