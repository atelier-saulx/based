import test from 'ava'
import { newSchemas } from './data/newSchemas.js'
import { newToOld } from '../src/compat/newToOld.js'
import { oldToNew } from '../src/compat/oldToNew.js'
import { oldSchemas } from './data/oldSchemas.js'
import { validateSchema } from '../src/validateSchema.js'

test('test', async (t) => {
  // need validator that returns true false
  //t.true(validateSchema(oldToNew(oldSchemas[0])))

  t.deepEqual(newToOld(await oldToNew(oldSchemas[0])), oldSchemas[0])
})
test('test2', async (t) => {
  t.deepEqual(newToOld(await oldToNew(oldSchemas[1])), oldSchemas[1])
})
test('test3', async (t) => {
  t.deepEqual(newToOld(await oldToNew(oldSchemas[2])), oldSchemas[2])
})
test('test4', async (t) => {
  t.deepEqual(newToOld(await oldToNew(oldSchemas[3])), oldSchemas[3])
})
