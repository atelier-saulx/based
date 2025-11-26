import { test } from '../shared/index.js'
import { parseSchema } from '@based/sdk'

await test('types', async () => {
  const schema = parseSchema({
    types: {},
  })

  const schema2 = parseSchema(schema)
})
