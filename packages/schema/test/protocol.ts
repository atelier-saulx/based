import test from 'node:test'
import { StrictSchema } from '@based/schema'
import {
  updateTypeDefs,
  SchemaTypesParsedById,
  SchemaTypesParsed,
} from '../src/def/index.js'
import { readFromPacked } from '../dist/def/readFromPacked.js'
import { deepEqual } from 'node:assert'

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
          flap: { type: 'uint32' },
          snurp: {
            type: 'object',
            props: {
              long: { type: 'number' },
              lat: { type: 'number' },
              bla: { type: 'string' },
            },
          },
          gur: { type: 'uint8' },
        },
      },
    },
  }

  const parsed: SchemaTypesParsed = {}
  const parsedIDs: SchemaTypesParsedById = {}

  updateTypeDefs(schema, parsed, parsedIDs)

  console.log(parsed.thing.props)

  console.log('--------------------------------------')
  console.dir(readFromPacked(parsed.thing.packed).props, { depth: 10 })

  deepEqual(parsed.thing.props, readFromPacked(parsed.thing.packed).props)

  // read types back from buf
})
