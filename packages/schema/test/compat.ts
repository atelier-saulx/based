import test from 'ava'
// TODO: maybe nice to use for validate import { newSchemas } from './data/newSchemas.js'
import { oldSchemas } from './data/oldSchemas.js'
import { convertNewToOld, convertOldToNew } from '../src/index.js'

test('old schema compat mode', async (t) => {
  for (let i = 0; i < oldSchemas.length; i++) {
    const oldSchema = oldSchemas[i]
    t.deepEqual(
      convertNewToOld(convertOldToNew(oldSchema)),
      oldSchema,
      `Schema conversion oldSchemas index ${i}`
    )
  }
})
