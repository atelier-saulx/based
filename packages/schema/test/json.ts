import test from 'ava'
import { BasedSchema, setWalker } from '../src/index.js'
import { errorCollect, resultCollect } from './utils/index.js'

const schema: BasedSchema = {
  types: {
    aType: {
      prefix: 'at',
      fields: {
        json: {
          type: 'json',
        },
      },
    },
  },
  $defs: {},
  language: 'en',
  root: {
    fields: {},
  },
  prefixToTypeMapping: {
    at: 'aType',
  },
}

test('json field with keys in it', async (t) => {
  const json = {
    fieldA: 'record2FieldA',
    $id: '$id_inside_json',
    $alias: '$alias_inside_json',
  }
  const res = await setWalker(schema, {
    // type: 'aType',
    $id: 'at1',
    json,
  })
  t.assert(!errorCollect(res).length)
  t.deepEqual(resultCollect(res), [
    { path: ['json'], value: JSON.stringify(json) },
  ])
})
