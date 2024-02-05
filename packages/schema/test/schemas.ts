import test from 'ava'
import { newSchemas } from './data/newSchemas.js'
import { newToOld } from '../src/compat/newToOld.js'
import { oldToNew } from '../src/compat/oldToNew.js'
import { oldSchemas } from './data/oldSchemas.js'
import { validateSchema } from '../src/validateSchema.js'

// {} old => new validateSchema

// test('test', async (t) => {
//   newToOld(newSchemas[2])
//   t.true(true)
// })

test('test', async (t) => {
  // console.dir(newToOld(await oldToNew(oldSchemas[0])), { depth: null })
  // validateSchema(oldToNew(oldSchemas[1]))
  t.deepEqual(newToOld(await oldToNew(oldSchemas[0])), oldSchemas[0])
  t.deepEqual(newToOld(await oldToNew(oldSchemas[1])), oldSchemas[1])
  t.deepEqual(newToOld(await oldToNew(oldSchemas[2])), oldSchemas[2])
  // t.true(true)
})
