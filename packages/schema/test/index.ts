import test from 'node:test'
import { parseSchema, type Schema } from '../src/schema/schema.ts'
import { schemaToDefs } from '../src/schema/def.ts'

await test('testings', () => {
  const schema = parseSchema({
    types: {
      author: {
        name: 'string',
        articles: {
          ref: 'article',
          prop: 'author',
        },
      },
      article: {
        props: {
          // externalId: {
          //   type: 'alias',
          // },
          // friendlyUrl: {
          //   type: 'alias',
          // },
          // body: {
          //   type: 'string',
          // },
          // age: 'number',
          // coolGuy: 'boolean',
          // address: {
          //   type: 'object',
          //   props: {
          //     street: 'string',
          //   },
          // },
          author: {
            ref: 'author',
            prop: 'articles',
          },
        },
      },
    },
  } as Schema)
  console.dir(schema, { depth: null })
  const defs = schemaToDefs(schema)

  console.dir(defs, { depth: null })
})
