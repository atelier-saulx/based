import test from 'node:test'
import { StrictSchema } from '@based/schema'
import { deepEqual } from 'node:assert'

await test('serialize', async (t) => {
  const schema: StrictSchema = {
    types: {
      thing: {
        id: 1,
        props: {
          derp: {
            type: 'string',
          },
          flap: {
            type: 'uint32',
            validation: (derp: boolean) => {
              return true
            },
          },
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
  console.log('derp')
})
