import test from 'ava'
// TODO: maybe nice to use for validate import { newSchemas } from './data/newSchemas.js'
import { oldSchemas } from './data/oldSchemas.js'
import {
  convertNewToOld,
  convertOldToNew,
  validateSchema,
} from '../src/index.js'

import { newSchemas } from './data/newSchemas.js'

test('old schema compat mode', async (t) => {
  // for (let i = 0; i < oldSchemas.length; i++) {
  for (let i = 0; i < 1; i++) {
    const oldSchema = oldSchemas[i]

    const newSchema = convertOldToNew(oldSchema)

    const validation = await validateSchema(newSchema)

    t.true(validation.valid)

    const thingy = convertNewToOld(newSchema)

    // console.dir(convertNewToOld(newSchema), { depth: null })
    console.dir(newSchema, { depth: null })

    // t.deepEqual(oldSchema, thingy, `Schema conversion oldSchemas index ${i}`)
  }
})
