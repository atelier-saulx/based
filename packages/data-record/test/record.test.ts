import {
  compile,
  createRecord,
  readValue,
  readString,
  deserializeRecordPArray,
} from '../src/index.js'
import test from 'ava'

const subRecordDef = [{ name: 'value', type: 'uint32_le' }]
const recordDef = [
  { name: 'a', type: 'uint32_le' },
  // { name: 'name', type: 'cstring', size: 15 },
  { name: 'values', type: 'record_p' },
  { name: 'more', type: 'cstring_p' },
]

Object.freeze(subRecordDef)
Object.freeze(recordDef)

test.only('A simple record pointer', (t) => {
  const sub = compile(subRecordDef)
  const rec = compile(recordDef)
  const buf = createRecord(rec, {
    a: 42,
    // name: 'Joe',
    values: createRecord(sub, { value: 1337 }),
    more: 'hello hello',
  })

  console.log(rec, buf)

  t.is(readValue(rec, buf, '.a'), 42)
  const subBuf = readValue<Buffer>(rec, buf, '.values')
  t.truthy(subBuf)
  t.is(readValue(sub, subBuf, '.value'), 1337)
  t.is(readString(rec, buf, '.more', 'utf-8'), 'hello hello')
})

test('Deserialize a record pointer', (t) => {
  const sub = compile(subRecordDef)
  const rec = compile(recordDef)
  const buf = createRecord(rec, {
    a: 42,
    name: 'Joe',
    values: createRecord(sub, { value: 1 }),
    more: 'hello hello',
  })
  t.is(readValue(rec, buf, '.a'), 42)
  const subs = deserializeRecordPArray(rec, buf, '.values', sub)
  t.deepEqual(subs, [{ value: 1 }])
  t.is(readString(rec, buf, '.more', 'utf-8'), 'hello hello')
})

test('An array of records', (t) => {
  const sub = compile(subRecordDef)
  const rec = compile(recordDef)
  const buf = createRecord(rec, {
    a: 42,
    name: 'Joe',
    values: [
      createRecord(sub, { value: 1 }),
      createRecord(sub, { value: 2 }),
      createRecord(sub, { value: 3 }),
      createRecord(sub, { value: 4 }),
    ],
    more: 'hello hello',
  })
  t.is(readValue(rec, buf, '.a'), 42)
  const subs = deserializeRecordPArray(rec, buf, '.values', sub)
  t.deepEqual(subs, [{ value: 1 }, { value: 2 }, { value: 3 }, { value: 4 }])
  t.is(readString(rec, buf, '.more', 'utf-8'), 'hello hello')
})
