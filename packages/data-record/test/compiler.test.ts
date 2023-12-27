import {
  allocRecord,
  ENDIANNESS,
  compile,
  generateRecordDef,
} from '../src/index.js'
import test from 'ava'

const def = [{ type: 'cstring_p', name: 's' }]
const compiled = compile(def)

test('Throws if heapsize is not an integer', (t) => {
  t.throws(() => allocRecord(compiled, { heapSize: 10.5 }))
})

test('Allocate unpooled', (t) => {
  t.true('copy' in allocRecord(compiled, { unpool: true }))
})

test('Generates a somewhat sane definition', (t) => {
  const obj = {
    value: 1,
    num: 1.2345,
    text: 'hello',
  }
  const def = generateRecordDef(obj)
  ;[
    { name: 'value', type: 'double_le' },
    { name: 'num', type: 'double_le' },
    { name: 'text', type: 'cstring', size: 5 },
  ]

  if (ENDIANNESS === 'BE') {
    t.deepEqual(def[0], { name: 'value', type: 'double_be' })
    t.deepEqual(def[1], { name: 'num', type: 'double_be' })
  } else {
    t.deepEqual(def[0], { name: 'value', type: 'double_le' })
    t.deepEqual(def[1], { name: 'num', type: 'double_le' })
  }
  t.deepEqual(def[2], { name: 'text', type: 'cstring', size: 5 })
})

test('Not an array', (t) => {
  const def = {
    a: { type: 'uint8' },
  }
  // @ts-expect-error
  t.throws(() => compile(def))
})

test('Field names must be unique', (t) => {
  const def = [
    { name: 'a', type: 'uint8' },
    { name: 'a', type: 'uint32' },
  ]
  t.throws(() => compile(def))
})

test('Unknown type is rejected', (t) => {
  const def = [{ name: 'a', type: 'uint128' }]
  t.throws(() => compile(def))
})

test('Invalid array size: negative', (t) => {
  const def = [{ name: 'a', type: 'uint8[-1]' }]
  t.throws(() => compile(def))
})

test('Invalid array size: float', (t) => {
  const def = [{ name: 'a', type: 'uint8[1.5]' }]
  t.throws(() => compile(def))
})

test('Invalid array size: wrong type', (t) => {
  const def = [{ name: 'a', type: 'uint8[hello]' }]
  t.throws(() => compile(def))
})

test('Subrecord needs a definition', (t) => {
  const def = [{ name: 'a', type: 'record' }]
  t.throws(() => compile(def))
})

test('Variable sized type errors: size must be an integer', (t) => {
  const def = [{ name: 'a', type: 'int', size: 1.5 }]
  t.throws(() => compile(def))
})

test('Variable sized type errors: size must be positive', (t) => {
  const def = [{ name: 'a', type: 'int', size: -1 }]
  t.throws(() => compile(def))
})

test('Variable sized type errors: size must be a number', (t) => {
  const def = [{ name: 'a', type: 'int', size: 'hello' }]
  // @ts-expect-error
  t.throws(() => compile(def))
})
