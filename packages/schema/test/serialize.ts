import test from 'node:test'
import { StrictSchema, deSerialize, serialize } from '@based/schema'
import { deepEqual } from 'node:assert'
import exampleSchema from './schema/based.schema.js'
import { deflate, deflateSync, inflateSync } from 'node:zlib'

await test('serialize', async (t) => {
  const schema: StrictSchema = {
    // special format for locales
    // locales: {
    //   en: { required: true },
    //   fr: { required: true },
    //   nl: { required: true },
    //   el: { required: true },
    //   he: { required: true },
    //   it: { required: true },
    //   lv: { required: true },
    //   lb: { required: true },
    //   ro: { required: true },
    //   sl: { required: true },
    //   es: { required: true },
    //   de: { required: true },
    //   cs: { required: true },
    //   et: { required: true },
    // },
    types: {
      a: {
        id: 1,
        props: {
          x: {
            type: 'number',
            // default: 12.123,
          },
          bla: {
            type: 'binary',
            default: new Uint8Array([1, 2, 3, 4]),
          },
          snurp: {
            items: {
              ref: 'a',
              prop: 'snurp', // extra value?
            },
            default: [1, 2, 3],
            // validation: (payload, prop) => {
            //   if (Array.isArray(payload) && payload.includes((v) => v > 10)) {
            //     return false
            //   }
            //   return true
            // },
          },
          a: { type: 'string' },
          abcdefh: { type: 'string' },
          abcdefhasdfasd: { type: 'string' },
          abcdefhasdfasdsdadas: { type: 'string' },
          abcdefhasdfasdsdadasabcdefhasdfasdsdadas: { type: 'string' },

          derp: {
            type: 'string',
          },
          flap: {
            type: 'uint32',
            // validation: () => {
            //   return true
            // },
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

  // 3 styles => full with meta (title, examples, description), with validation and defaults, readOnly
  const serializedSchema = serialize(schema, {
    deflate: false,
    readOnly: false,
  })

  console.log(
    deflateSync(JSON.stringify(schema)).byteLength,
    serializedSchema.byteLength,
    serializedSchema,
    // @ts-ignore
    // [...serializedSchema].map((v, i) => [v, String.fromCharCode(v), i]),
  )
  console.dir(deSerialize(serializedSchema), { depth: 10 })
  console.log('----------------')
  console.dir(
    JSON.parse(inflateSync(deflateSync(JSON.stringify(schema))).toString()),
    {
      depth: 10,
    },
  )

  // let d = Date.now()
  // for (let i = 0; i < 1e5; i++) {
  //   deSerialize(serializedSchema)
  // }
  // console.log(Date.now() - d, 'ms')

  // d = Date.now()
  // for (let i = 0; i < 1e5; i++) {
  //   JSON.parse(inflateSync(deflateSync(JSON.stringify(schema))).toString())
  // }
  // console.log(Date.now() - d, 'ms')

  const euroVision = serialize(exampleSchema, { deflate: false })
  console.log(deflateSync(JSON.stringify(exampleSchema)).byteLength, euroVision)

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
