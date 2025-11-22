import test from 'node:test'
import { parseSchema } from '../src/schema/schema.js'

await test('required', () => {
  parseSchema({
    types: {
      role: {
        name: {
          type: 'string',
          default: 'John Doe',
          required: true,
        },
        age: {
          type: 'uint8',
          default: 21,
          required: false,
        },
      },
    },
  })
})
