import test from 'node:test'
import { StrictSchema, deSerialize, serialize } from '@based/schema'
import { deepEqual } from 'node:assert'
import exampleSchema from './schema/based.schema.js'

await test('serialize', async (t) => {
  const schema: StrictSchema = {
    locales: {
      en: { required: true },
      fr: { required: true },
      nl: { required: true },
      el: { required: true },
      he: { required: true },
      it: { required: true },
      lv: { required: true },
      lb: { required: true },
      ro: { required: true },
      sl: { required: true },
      es: { required: true },
      de: { required: true },
      cs: { required: true },
      et: { required: true },
    },
    types: {
      a: {
        id: 1,
        props: {
          x: {
            type: 'number',
            default: 12.123,
          },
          bla: {
            type: 'binary',
            default: new Uint8Array([1, 2, 3, 4]),
          },
          snurp: {
            items: {
              ref: 'a',
              prop: 'snurp',
            },
            default: [1, 2, 3],
            validation: (payload, prop) => {
              if (Array.isArray(payload) && payload.includes((v) => v > 10)) {
                return false
              }
              return true
            },
          },

          derp: {
            type: 'string',
          },
          flap: {
            type: 'uint32',
            validation: () => {
              return true
            },
          },
          gur: { type: 'uint8' },
          hallo: { type: 'text' },
          y: {
            type: 'object',
            props: {
              snurf: { type: 'boolean' },
            },
          },
        },
      },
    },
  }

  const decoder = new TextDecoder()

  // const serializedSchema = serialize(
  //   {
  //     a: {},
  //     b: {},
  //   },
  //   true,
  // )

  const serializedSchema = serialize(schema, true)

  console.log(
    serializedSchema,
    // @ts-ignore
    [...serializedSchema].map((v) => [v, String.fromCharCode(v)]),
  )
  console.dir(deSerialize(serializedSchema), { depth: 10 })

  const euroVision = serialize(exampleSchema, true)
  console.log(euroVision)

  console.log(deSerialize(euroVision))

  // let d = Date.now()

  // for (let i = 0; i < 1e6; i++) {
  //   const serializedSchema = serialize(schema, true)
  // }

  // // const serializedSchema = serialize(schema, true)

  // // const encoder = new TextEncoder()

  // // const x = encoder.encode(JSON.stringify(schema))
  // console.log(Date.now() - d, 'ms')

  // const y = decoder.decode(serializedSchema)

  // console.log(`"${y}"`)

  // const r = deSerialize(serializedSchema)

  // console.log('derp', serializedSchema)

  // console.dir(r, { depth: 10 })
})
