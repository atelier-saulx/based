import test from 'node:test'
import { parseSchema } from '../src/index.js'

await test('types', () => {
  const schema = parseSchema({
    types: {},
  })

  const schema2 = parseSchema(schema)
})
