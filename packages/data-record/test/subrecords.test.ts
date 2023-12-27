import {
  compile,
  createRecord,
  readValue,
  readString,
  writeValue,
} from '../src/index.js'
import test from 'ava'

const recordDefEx = [
  { name: 'a', type: 'uint32_le' },
  { name: 'b', type: 'int32_le' },
  { name: 'c', type: 'int_le', size: 3 },
  { name: 'd', type: 'int_le', size: 5 },
  {
    name: 'nested',
    type: 'record',
    def: [
      { name: 'a', type: 'uint32_le' },
      { name: 'b', type: 'uint32_le' },
    ],
  },
  {
    name: 'x',
    type: 'record',
    def: [
      { name: 'a', type: 'uint32_le' },
      {
        name: 'y',
        type: 'record',
        def: [{ name: 'a', type: 'uint32_le' }],
      },
    ],
  },
  { name: 'firstName', type: 'cstring', size: 15 },
]

const obj = {
  a: 4,
  b: -128,
  c: 10,
  d: 5,
  nested: {
    a: 5,
    b: 5,
  },
  x: {
    a: 5,
    y: {
      a: 5,
    },
  },
  firstName: 'Olli',
}

// TODO Alignment isn't supported properly
const compiled = compile(recordDefEx, { align: false })

Object.freeze(recordDefEx)
Object.freeze(obj)
Object.freeze(compiled)

test('Can read from nested subrecords', (t) => {
  const buf = createRecord(compiled, obj)
  t.is(readValue(compiled, buf, '.x.y.a'), 5)
  t.is(readString(compiled, buf, '.firstName', 'utf8'), 'Olli')
})

test('Can write to nested subrecords', (t) => {
  const buf = createRecord(compiled, obj)
  writeValue(compiled, buf, '.x.y.a', 1337)
  t.is(readValue(compiled, buf, '.x.y.a'), 1337)
})
