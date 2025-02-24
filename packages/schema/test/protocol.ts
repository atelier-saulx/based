import test from 'node:test'
import { StrictSchema } from '@based/schema'
import {
  updateTypeDefs,
  SchemaTypesParsedById,
  SchemaTypesParsed,
} from '../src/def/index.js'

// schema byte format

await test('protocol', (t) => {
  const schema: StrictSchema = {
    types: {
      thing: {
        id: 1,
        props: {
          derp: {
            type: 'string',
          },
          snurp: {
            type: 'object',
            props: {
              long: { type: 'number' },
              lat: { type: 'number' },
            },
          },
        },
      },
    },
  }

  const parsed: SchemaTypesParsed = {}
  const parsedIDs: SchemaTypesParsedById = {}

  updateTypeDefs(schema, parsed, parsedIDs)

  // use path

  console.log(JSON.stringify(parsed))
})
