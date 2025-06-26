import test from 'node:test'
import { StrictSchema, deSerialize, serialize } from '@based/schema'
import { deepEqual } from 'node:assert'

await test('serialize', async (t) => {
  const schema: StrictSchema = {
    types: {
      a: {
        // id: 1,
        props: {
          // x: {
          //   type: 'number',
          //   default: 12.123,
          // },
          // bla: {
          //   type: 'binary',
          //   default: new Uint8Array([1, 2, 3, 4]),
          // },
          snurp: {
            items: {
              ref: 'a',
              prop: 'snurp',
            },
            default: [1, 2, 3],
          },
        },
        //   props: {
        //     derp: {
        //       type: 'string',
        //     },
        //     flap: {
        //       type: 'uint32',
        //       // validation: (derp: boolean) => {
        //       //   return true
        //       // },
        //     },
        //     snurp: {
        //       type: 'object',
        //       props: {
        //         long: { type: 'number' },
        //         lat: { type: 'number' },
        //         bla: { type: 'string' },
        //       },
        //     },
        //     gur: { type: 'uint8' },
        //     hallo: { type: 'text' },
        //     x: {
        //       type: 'object',
        //       props: {
        //         snurf: { type: 'boolean' },
        //       },
        //     },
        //   },
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

  // console.log(serialize(schema, false))

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
