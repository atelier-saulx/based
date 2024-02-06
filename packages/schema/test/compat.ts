import test from 'ava'
// TODO: maybe nice to use for validate import { newSchemas } from './data/newSchemas.js'
import { oldSchemas } from './data/oldSchemas.js'
import {
  convertNewToOld,
  convertOldToNew,
  validateSchema,
} from '../src/index.js'

test.failing('old schema compat mode', async (t) => {
  for (let i = 0; i < oldSchemas.length; i++) {
    const oldSchema = oldSchemas[i]

    const newSchema = convertOldToNew(oldSchema)

    const validation = await validateSchema(newSchema)

    // console.info(validation.errors)

    t.true(validation.valid)

    t.deepEqual(
      convertNewToOld(newSchema),
      oldSchema,
      `Schema conversion oldSchemas index ${i}`
    )
  }
})
