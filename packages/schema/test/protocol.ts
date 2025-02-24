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

  console.log(parsed.thing.buf, parsed.thing.propNames)

  // read types back from buf

  const props: any = []
  const b = parsed.thing.buf
  let collectMain = false

  const mainProps = []

  const typeId = b.subarray(0, 2)

  for (let i = 2; i < b.length; i++) {
    const prop = b[i]
    if (collectMain) {
      if (prop === 0) {
        collectMain = false
      } else {
        mainProps.push({
          prop: i - 3,
          typeIndex: b[i],
        })
      }
    } else {
      if (prop == 0) {
        collectMain = true
      } else {
        props.push({ prop, typeIndex: b[i + 1] })
        i++
      }
    }
  }

  const decoder = new TextDecoder()
  const fields: any = []
  const f = parsed.thing.propNames
  for (let i = 0; i < f.length; i++) {
    const size = f[i]
    fields.push(decoder.decode(f.subarray(i + 1, i + 1 + size)))
    i += size
  }

  for (let i = 0; i < mainProps.length; i++) {
    mainProps[i].path = fields[i + 1]
  }

  for (let i = 0; i < props.length; i++) {
    props[i].path = fields[i + 1 + mainProps.length]
  }

  console.log({
    type: fields[0],
    fields,
    typeId,
    props,
    mainProps,
  })
})
