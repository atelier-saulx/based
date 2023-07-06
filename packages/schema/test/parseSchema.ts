import test from 'ava'
import { parseSchema } from './parseSchema'

test.serial('parse and validate schema', async (t) => {
  // this will be the internally stored one
  const newSchema = parseSchema({})

  // validateType(type, payload)

  // validatePath(type, path, payload)

  // validateTypeById(id, payload)

  // validatePathById(id, path, payload)

  t.true(true)
})
