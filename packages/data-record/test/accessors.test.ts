import {
  compile,
  createRecord,
  readValue,
  readString,
  writeValue,
  writeString,
  createReader,
  createStringReader,
  createWriter,
} from '../src/index.js'
import test from 'ava'

const def = [
  { name: 'a', type: 'int8' },
  { name: 'b', type: 'int16' },
  { name: 'c', type: 'int16_be' },
  { name: 'd', type: 'int16_le' },
  { name: 'e', type: 'int32' },
  { name: 'f', type: 'int32_be' },
  { name: 'g', type: 'int32_le' },
  { name: 'h', type: 'int64' },
  { name: 'i', type: 'int64_be' },
  { name: 'j', type: 'int64_le' },
  { name: 'k', type: 'uint8' },
  { name: 'l', type: 'uint16' },
  { name: 'm', type: 'uint16_be' },
  { name: 'n', type: 'uint16_le' },
  { name: 'o', type: 'uint32' },
  { name: 'p', type: 'uint32_be' },
  { name: 'q', type: 'uint32_le' },
  { name: 'r', type: 'uint64' },
  { name: 's', type: 'uint64_be' },
  { name: 't', type: 'uint64_le' },
  { name: 'u', type: 'float' },
  { name: 'v', type: 'float_be' },
  { name: 'w', type: 'float_le' },
  { name: 'x', type: 'double' },
  { name: 'y', type: 'double_be' },
  { name: 'z', type: 'double_le' },
  { name: '0', type: 'int', size: 3 },
  { name: '1', type: 'int_be', size: 3 },
  { name: '2', type: 'int_le', size: 3 },
  { name: '3', type: 'uint', size: 3 },
  { name: '4', type: 'uint_be', size: 3 },
  { name: '5', type: 'uint_le', size: 3 },
  { name: '6', type: 'cstring', size: 10 },
  { name: '7', type: 'cstring_p' },
]

const obj = {
  a: -127,
  b: 0x4020,
  c: 0x4020,
  d: 0x4020,
  e: 0x10004020,
  f: 0x10004020,
  g: 0x10004020,
  h: BigInt('0x40400010004020'),
  i: BigInt('0x40400010004020'),
  j: BigInt('0x40400010004020'),
  k: 127,
  l: 0x4020,
  m: 0x4020,
  n: 0x4020,
  o: 0x10004020,
  p: 0x10004020,
  q: 0x10004020,
  r: BigInt('0x40400010004020'),
  s: BigInt('0x40400010004020'),
  t: BigInt('0x40400010004020'),
  u: 1.5,
  v: 1.5,
  w: 1.5,
  x: 1.2345,
  y: 1.2345,
  z: 1.2345,
  0: 0x414141,
  1: 0x414141,
  2: 0x414141,
  3: 0x414141,
  4: 0x414141,
  5: 0x414141,
  6: 'hello',
  7: 'ciao',
}
const compiled = compile(def)

Object.freeze(def)
Object.freeze(obj)
Object.freeze(compiled)

test('createReader() int8', (t) => {
  const buf = createRecord(compiled, obj)
  const read = createReader(compiled, buf, '.a')

  t.is(read(), -127)
})

test('createReader() int16', (t) => {
  const buf = createRecord(compiled, obj)
  const read = createReader(compiled, buf, '.b')

  t.is(read(), 0x4020)
})

test('createReader() int16_be', (t) => {
  const buf = createRecord(compiled, obj)
  const read = createReader(compiled, buf, '.c')

  t.is(read(), 0x4020)
})

test('createReader() int16_le', (t) => {
  const buf = createRecord(compiled, obj)
  const read = createReader(compiled, buf, '.d')

  t.is(read(), 0x4020)
})

test('createReader() int32', (t) => {
  const buf = createRecord(compiled, obj)
  const read = createReader(compiled, buf, '.e')

  t.is(read(), 0x10004020)
})

test('createReader() int32_be', (t) => {
  const buf = createRecord(compiled, obj)
  const read = createReader(compiled, buf, '.f')

  t.is(read(), 0x10004020)
})

test('createReader() int32_le', (t) => {
  const buf = createRecord(compiled, obj)
  const read = createReader(compiled, buf, '.g')

  t.is(read(), 0x10004020)
})

test('createReader() int64', (t) => {
  const buf = createRecord(compiled, obj)
  const read = createReader(compiled, buf, '.h')

  t.is(read(), BigInt('0x40400010004020'))
})

test('createReader() int64_be', (t) => {
  const buf = createRecord(compiled, obj)
  const read = createReader(compiled, buf, '.i')

  t.is(read(), BigInt('0x40400010004020'))
})

test('createReader() int64_le', (t) => {
  const buf = createRecord(compiled, obj)
  const read = createReader(compiled, buf, '.j')

  t.is(read(), BigInt('0x40400010004020'))
})

test('createReader() uint8_t', (t) => {
  const buf = createRecord(compiled, obj)
  const read = createReader(compiled, buf, '.k')

  t.is(read(), 127)
})

test('createReader() uint16', (t) => {
  const buf = createRecord(compiled, obj)
  const read = createReader(compiled, buf, '.l')

  t.is(read(), 0x4020)
})

test('createReader() uint16_be', (t) => {
  const buf = createRecord(compiled, obj)
  const read = createReader(compiled, buf, '.m')

  t.is(read(), 0x4020)
})

test('createReader() uint16_le', (t) => {
  const buf = createRecord(compiled, obj)
  const read = createReader(compiled, buf, '.n')

  t.is(read(), 0x4020)
})

test('createReader() uint32', (t) => {
  const buf = createRecord(compiled, obj)
  const read = createReader(compiled, buf, '.o')

  t.is(read(), 0x10004020)
})

test('createReader() uint32_be', (t) => {
  const buf = createRecord(compiled, obj)
  const read = createReader(compiled, buf, '.p')

  t.is(read(), 0x10004020)
})

test('createReader() uint32_le', (t) => {
  const buf = createRecord(compiled, obj)
  const read = createReader(compiled, buf, '.q')

  t.is(read(), 0x10004020)
})

test('createReader() uint64', (t) => {
  const buf = createRecord(compiled, obj)
  const read = createReader(compiled, buf, '.r')

  t.is(read(), BigInt('0x40400010004020'))
})

test('createReader() uint64_be', (t) => {
  const buf = createRecord(compiled, obj)
  const read = createReader(compiled, buf, '.s')

  t.is(read(), BigInt('0x40400010004020'))
})

test('createReader() uint64_le', (t) => {
  const buf = createRecord(compiled, obj)
  const read = createReader(compiled, buf, '.t')

  t.is(read(), BigInt('0x40400010004020'))
})

test('createReader() float', (t) => {
  const buf = createRecord(compiled, obj)
  const read = createReader(compiled, buf, '.u')

  t.is(read(), 1.5)
})

test('createReader() float_be', (t) => {
  const buf = createRecord(compiled, obj)
  const read = createReader(compiled, buf, '.v')

  t.is(read(), 1.5)
})

test('createReader() float_le', (t) => {
  const buf = createRecord(compiled, obj)
  const read = createReader(compiled, buf, '.w')

  t.is(read(), 1.5)
})

test('createReader() double', (t) => {
  const buf = createRecord(compiled, obj)
  const read = createReader(compiled, buf, '.x')

  t.is(read(), 1.2345)
})

test('createReader() double_be', (t) => {
  const buf = createRecord(compiled, obj)
  const read = createReader(compiled, buf, '.y')

  t.is(read(), 1.2345)
})

test('createReader() double_le', (t) => {
  const buf = createRecord(compiled, obj)
  const read = createReader(compiled, buf, '.z')

  t.is(read(), 1.2345)
})

test('createReader() int', (t) => {
  const buf = createRecord(compiled, obj)
  const read = createReader(compiled, buf, '.0')

  t.is(read(), 0x414141)
})

test('createReader() int_be', (t) => {
  const buf = createRecord(compiled, obj)
  const read = createReader(compiled, buf, '.1')

  t.is(read(), 0x414141)
})

test('createReader() int_le', (t) => {
  const buf = createRecord(compiled, obj)
  const read = createReader(compiled, buf, '.2')

  t.is(read(), 0x414141)
})

test('createReader() uint', (t) => {
  const buf = createRecord(compiled, obj)
  const read = createReader(compiled, buf, '.3')

  t.is(read(), 0x414141)
})

test('createReader() uint_be', (t) => {
  const buf = createRecord(compiled, obj)
  const read = createReader(compiled, buf, '.4')

  t.is(read(), 0x414141)
})

test('createReader() uint_le', (t) => {
  const buf = createRecord(compiled, obj)
  const read = createReader(compiled, buf, '.5')

  t.is(read(), 0x414141)
})

test('createReader() utf8 cstring', (t) => {
  const buf = createRecord(compiled, obj)
  const read = createStringReader(compiled, buf, '.6', 'utf8')

  t.is(read(), 'hello')
})

test('createReader() ascii cstring', (t) => {
  const buf = createRecord(compiled, obj)
  const read = createStringReader(compiled, buf, '.6', 'ascii')

  const val = read()
  t.is(val, 'hello')
})

test('createReader() buffer cstring', (t) => {
  const buf = createRecord(compiled, obj)
  const read = createStringReader(compiled, buf, '.6')

  const val = read()
  t.truthy(Buffer.isBuffer(val))
  t.is(val?.toString('hex'), '68656c6c6f0000000000')
})

test.skip('createReader() utf8 cstring_p', (t) => {
  const buf = createRecord(compiled, obj)
  const read = createStringReader(compiled, buf, '.7', 'utf8')

  const val = read()
  t.is(val, 'ciao')
})

test('createReader() ascii cstring_p', (t) => {
  const buf = createRecord(compiled, obj)
  const read = createStringReader(compiled, buf, '.7', 'ascii')

  const val = read()
  t.is(val, 'ciao')
})

test('createReader() buffer cstring_p', (t) => {
  const buf = createRecord(compiled, obj)
  const read = createStringReader(compiled, buf, '.7')

  const val = read()
  t.truthy(Buffer.isBuffer(val))
  t.is(val?.toString('hex'), '6369616f')
})

test('createWriter() int8', (t) => {
  const buf = createRecord(compiled, obj)
  const read = createReader(compiled, buf, '.a')
  const write = createWriter(compiled, buf, '.a')

  write(127)
  t.is(read(), 127)
})

test('createWriter() int16', (t) => {
  const buf = createRecord(compiled, obj)
  const read = createReader(compiled, buf, '.b')
  const write = createWriter(compiled, buf, '.b')

  write(0x1512)
  t.is(read(), 0x1512)
})

test('createWriter() int16_be', (t) => {
  const buf = createRecord(compiled, obj)
  const read = createReader(compiled, buf, '.c')
  const write = createWriter(compiled, buf, '.c')

  write(0x1512)
  t.is(read(), 0x1512)
})

test('createWriter() int16_le', (t) => {
  const buf = createRecord(compiled, obj)
  const read = createReader(compiled, buf, '.d')
  const write = createWriter(compiled, buf, '.d')

  write(0x1512)
  t.is(read(), 0x1512)
})

test('createWriter() int32', (t) => {
  const buf = createRecord(compiled, obj)
  const read = createReader(compiled, buf, '.e')
  const write = createWriter(compiled, buf, '.e')

  write(0x41512)
  t.is(read(), 0x41512)
})

test('createWriter() int32_be', (t) => {
  const buf = createRecord(compiled, obj)
  const read = createReader(compiled, buf, '.f')
  const write = createWriter(compiled, buf, '.f')

  write(0x41512)
  t.is(read(), 0x41512)
})

test('createWriter() int32_le', (t) => {
  const buf = createRecord(compiled, obj)
  const read = createReader(compiled, buf, '.g')
  const write = createWriter(compiled, buf, '.g')

  write(0x41512)
  t.is(read(), 0x41512)
})

test('createWriter() int64', (t) => {
  const buf = createRecord(compiled, obj)
  const read = createReader(compiled, buf, '.h')
  const write = createWriter(compiled, buf, '.h')

  write(BigInt('0x40410014004020'))
  t.is(read(), BigInt('0x40410014004020'))
})

test('createWriter() int64_be', (t) => {
  const buf = createRecord(compiled, obj)
  const read = createReader(compiled, buf, '.i')
  const write = createWriter(compiled, buf, '.i')

  write(BigInt('0x40410014004020'))
  t.is(read(), BigInt('0x40410014004020'))
})

test('createWriter() int64_le', (t) => {
  const buf = createRecord(compiled, obj)
  const read = createReader(compiled, buf, '.j')
  const write = createWriter(compiled, buf, '.j')

  write(BigInt('0x40410014004020'))
  t.is(read(), BigInt('0x40410014004020'))
})

test('createWriter() cstring', (t) => {
  const buf = createRecord(compiled, obj)
  const read = createStringReader(compiled, buf, '.6', 'utf8')
  const write = createWriter(compiled, buf, '.6')

  // Note that the writer doesn't not clear the string
  write('ab')
  t.is(read(), 'abllo')
})

test('createWriter() cstring buffer', (t) => {
  const buf = createRecord(compiled, obj)
  const read = createStringReader(compiled, buf, '.6', 'utf8')
  const write = createWriter(compiled, buf, '.6')

  // Note that the writer doesn't not clear the string
  write(Buffer.from('buffero'))
  t.is(read(), 'buffero')
})

test('createWriter() cstring nul-terminating', (t) => {
  const buf = createRecord(compiled, obj)
  const read = createStringReader(compiled, buf, '.6', 'utf8')
  const write = createWriter(compiled, buf, '.6')

  // Note that the writer doesn't not clear the string
  write('ab\0')
  t.is(read(), 'ab')
})

test('readValue() throws not found', (t) => {
  const buf = createRecord(compiled, obj)
  t.throws(() => readValue(compiled, buf, '.not_found'))
})

test('readString() throws not found', (t) => {
  const buf = createRecord(compiled, obj)
  t.throws(() => readString(compiled, buf, '.not_found'))
})

test('readString() throws not a string', (t) => {
  const buf = createRecord(compiled, obj)
  t.throws(() => readString(compiled, buf, '.a'))
})

test('writeValue() throws not found', (t) => {
  const buf = createRecord(compiled, obj)
  t.throws(() => writeValue(compiled, buf, '.not_found', 100))
})

test('writeValue() throws cannot write to a pointer', (t) => {
  const buf = createRecord(compiled, obj)
  t.throws(() => writeValue(compiled, buf, '.7', 100))
})

test('writeString() throws not found', (t) => {
  const buf = createRecord(compiled, obj)
  t.throws(() => writeString(compiled, buf, '.not_found', 'zyx'))
})

test('writeString() throws not a string', (t) => {
  const buf = createRecord(compiled, obj)
  t.throws(() => writeString(compiled, buf, '.a', 'zyx'))
})

test('createReader() throws not found', (t) => {
  const buf = createRecord(compiled, obj)
  t.throws(() => createReader(compiled, buf, '.not_found'))
})

test('createStringReader() throws not found', (t) => {
  const buf = createRecord(compiled, obj)
  t.throws(() => createStringReader(compiled, buf, '.not_found'))
})

test('createStringReader() throws not a string', (t) => {
  const buf = createRecord(compiled, obj)
  t.throws(() => createStringReader(compiled, buf, '.c'))
})

test('createWriter() throws not supported for cstring_p', (t) => {
  const buf = createRecord(compiled, obj)
  t.throws(() => createWriter(compiled, buf, '.7'))
})

test('createWriter() throws not found', (t) => {
  const buf = createRecord(compiled, obj)
  t.throws(() => createWriter(compiled, buf, '.not_found'))
})
