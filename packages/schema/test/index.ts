import test from 'node:test'
import { parseSchema } from '../src/schema/schema.ts'
import { schemaToDefs } from '../src/schema/def.ts'

await test('testings', () => {
  const schema = parseSchema({
    types: {
      article: {
        props: {
          externalId: {
            type: 'alias',
          },
          friendlyUrl: {
            type: 'alias',
          },
          body: {
            type: 'string',
          },
        },
      },
    },
  })

  const defs = schemaToDefs(schema)

  console.dir(defs, { depth: null })
})
