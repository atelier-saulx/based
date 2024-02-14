import test from 'ava'
// TODO: maybe nice to use for validate import { newSchemas } from './data/newSchemas.js'

import { newSchemas } from './data/newSchemas.js'
import { oldSchemas } from './data/oldSchemas.js'
import {
  convertNewToOld,
  convertOldToNew,
  validateSchema,
} from '../src/index.js'

test('old schema compat mode', async (t) => {
  for (let i = 0; i < oldSchemas.length - 1; i++) {
    const oldSchema = oldSchemas[i]
    const newSchema = convertOldToNew(oldSchema)
    const validation = await validateSchema(newSchema)
    t.true(validation.valid)

    t.deepEqual(
      oldSchema,
      convertNewToOld(newSchema),
      `Schema conversion oldSchemas index ${i}`
    )
  }
})

test.only('new schema compat mode', async (t) => {
  for (let i = 0; i < newSchemas.length - 1; i++) {
    const newSchema = newSchemas[i]
    const validation = await validateSchema(newSchema)
    const oldSchema = convertNewToOld(newSchema)

    t.true(validation.valid)

    t.deepEqual(
      newSchema,
      convertOldToNew(oldSchema),
      `Schema conversion newSchemas index ${i}`
    )
  }
})
