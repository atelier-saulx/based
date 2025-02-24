import test from 'node:test'
import { StrictSchema } from '@based/schema'
import {
  updateTypeDefs,
  SchemaTypesParsedById,
  SchemaTypesParsed,
} from '../src/def/index.js'

// schema byte format

await test('protocol', () => {
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

  console.log(parsed, parsedIDs)
})
