import test from 'node:test'
import { StrictSchema } from '@based/schema'
import {
  updateTypeDefs,
  SchemaTypesParsedById,
  SchemaTypesParsed,
} from '../src/def/index.js'
import { readFromPacked } from '../dist/def/readFromPacked.js'
import { deepEqual } from 'node:assert'
import { promisify } from 'node:util'
import { deflate, inflate } from 'node:zlib'

const d = promisify(deflate)
const inf = promisify(inflate)

// schema byte format

await test.skip('protocol', async (t) => {
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
          hallo: { type: 'text' },
          x: {
            type: 'object',
            props: {
              snurf: { type: 'boolean' },
            },
          },
        },
      },
    },
  }

  // console.log(new Uint8Array(Buffer.from(JSON.stringify(schema))))

  // TODO
  // fixedLen STRINGS
  // reference
  // references

  const parsed: SchemaTypesParsed = {}
  const parsedIDs: SchemaTypesParsedById = {}

  updateTypeDefs(schema, parsed, parsedIDs)

  const simple = await d(JSON.stringify(schema))

  // console.log({
  //   u8: parsed.thing.packed,
  //   x: Buffer.from(parsed.thing.packed).toString(),
  // })

  console.log(
    simple.byteLength,
    parsed.thing.packed.byteLength,
    '+' +
      (~~((simple.byteLength / parsed.thing.packed.byteLength) * 100) - 100) +
      '% size with lazy deflated version',
  )

  const dX = await d(parsed.thing.packed)
  console.log(
    simple.byteLength,
    dX.byteLength,
    '+' +
      (~~((simple.byteLength / dX.byteLength) * 100) - 100) +
      '% size with lazy deflated version',
  )

  // for now just send the whole thing deflated (108 vs 65)

  const unpacked = readFromPacked(parsed.thing.packed)
  deepEqual(parsed.thing.props, unpacked.props)
  deepEqual(parsed.thing.reverseProps, unpacked.reverseProps)
  deepEqual(parsed.thing.main, unpacked.main)

  const parsed2: SchemaTypesParsed = {}
  const parsedIDs2: SchemaTypesParsedById = {}

  updateTypeDefs(
    JSON.parse((await inf(simple)).toString()),
    parsed2,
    parsedIDs2,
  )

  deepEqual(parsed2, parsed)

  // need to add creating a queryDef from the BUFFER which is quite some work
  // then we can combine with the packed stuff and we have it
})
