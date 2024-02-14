import test from 'ava'
import { newSchemas } from '../data/newSchemas.js'
import { validateSchema } from '../../src/index.js'

test('these schemas should work', async (t) => {
  await Promise.all(
    newSchemas.map(async (validSchema) => {
      const validation = await validateSchema(validSchema)
      if (!validation.valid) {
        console.dir(validation.errors, { depth: null })
      }
      t.true(validation.valid)
    })
  )
})
