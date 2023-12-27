import {
  compile,
  createRecord,
  WORD_SIZE,
  SIZES,
  TYPES,
  deserialize,
  createReader,
  readValue,
  readString,
} from '../src/index.js'
import test from 'ava'

test('a null pointer', async (t) => {
  const recordDef = [{ name: 'numbers', type: 'int8_p' }]
  const compiled = compile(recordDef, { align: true })
  const buf = createRecord(compiled, {
    numbers: null,
  })
  const offset = Number(buf.readBigUInt64LE(0))
  t.is(offset, 0)
})

test('a pointer to an int8 array', async (t) => {
  const recordDef = [{ name: 'numbers', type: 'int8_p' }]
  const compiled = compile(recordDef, { align: true })
  const buf = createRecord(compiled, {
    numbers: [1, 2, 3],
  })
  const offset = Number(buf.readBigUInt64LE(0))
  t.is(offset, 2 * WORD_SIZE)
  const size = Number(buf.readBigUInt64LE(WORD_SIZE))
  t.is(size, 3)
  const v1 = Number(buf.readInt8(2 * WORD_SIZE + 0))
  t.is(v1, 1)
  const v2 = Number(buf.readInt8(2 * WORD_SIZE + 1))
  t.is(v2, 2)
  const v3 = Number(buf.readInt8(2 * WORD_SIZE + 2))
  t.is(v3, 3)
})

test('a pointer to an int16_be array', async (t) => {
  const recordDef = [{ name: 'numbers', type: 'int16_be_p' }]
  const compiled = compile(recordDef, { align: true })
  const buf = createRecord(compiled, {
    numbers: [1, 2, 3],
  })

  const offset = Number(buf.readBigUInt64LE(0))
  t.is(offset, 2 * WORD_SIZE)

  const size = Number(buf.readBigUInt64LE(WORD_SIZE))
  t.is(size, 6)

  const v1 = Number(buf.readInt16BE(2 * WORD_SIZE + 0))
  t.is(v1, 1)

  const v2 = Number(buf.readInt16BE(2 * WORD_SIZE + 2))
  t.is(v2, 2)

  const v3 = Number(buf.readInt16BE(2 * WORD_SIZE + 4))
  t.is(v3, 3)
})

test('a pointer to an int32_le array', async (t) => {
  const recordDef = [{ name: 'numbers', type: 'int32_le_p' }]
  const compiled = compile(recordDef, { align: true })
  const buf = createRecord(compiled, {
    numbers: [122355975, 244711950, 235050510],
  })

  const offset = Number(buf.readBigUInt64LE(0))
  t.is(offset, 2 * WORD_SIZE)

  const size = Number(buf.readBigUInt64LE(WORD_SIZE))
  t.is(size, 3 * SIZES[TYPES.int32_le])

  const v1 = Number(buf.readInt32LE(2 * WORD_SIZE + 0))
  t.is(v1, 122355975)

  const v2 = Number(buf.readInt32LE(2 * WORD_SIZE + 4))
  t.is(v2, 244711950)

  const v3 = Number(buf.readInt32LE(2 * WORD_SIZE + 8))
  t.is(v3, 235050510)
})

test('a pointer to an uint32_le array', async (t) => {
  const recordDef = [{ name: 'numbers', type: 'uint32_le_p' }]
  const compiled = compile(recordDef, { align: true })
  const buf = createRecord(compiled, {
    numbers: [122355975, 2392195598, 235050510],
  })

  const offset = Number(buf.readBigUInt64LE(0))
  t.is(offset, 2 * WORD_SIZE)

  const size = Number(buf.readBigUInt64LE(WORD_SIZE))
  t.is(size, 3 * SIZES[TYPES.uint32_le])

  const v1 = Number(buf.readUInt32LE(2 * WORD_SIZE + 0))
  t.is(v1, 122355975)

  const v2 = Number(buf.readUInt32LE(2 * WORD_SIZE + 4))
  t.is(v2, 2392195598)

  const v3 = Number(buf.readUInt32LE(2 * WORD_SIZE + 8))
  t.is(v3, 235050510)
})

test('a pointer to an int64_le array', async (t) => {
  const recordDef = [{ name: 'numbers', type: 'uint64_le_p' }]
  const compiled = compile(recordDef, { align: true })
  const buf = createRecord(compiled, {
    numbers: [BigInt('3122306873021878513'), BigInt('11665128381306721961')],
  })

  const offset = Number(buf.readBigUInt64LE(0))
  t.is(offset, 2 * WORD_SIZE)

  const size = Number(buf.readBigUInt64LE(WORD_SIZE))
  t.is(size, 2 * SIZES[TYPES.uint64_le])

  const v1 = buf.readBigUInt64LE(2 * WORD_SIZE + 0)
  t.is(v1, BigInt('3122306873021878513'))

  const v2 = buf.readBigUInt64LE(2 * WORD_SIZE + 8)
  t.is(v2, BigInt('11665128381306721961'))
})

test('a pointer to an float_le array', async (t) => {
  const recordDef = [{ name: 'numbers', type: 'float_le_p' }]
  const compiled = compile(recordDef, { align: true })
  const buf = createRecord(compiled, {
    numbers: [8.5, 6.5],
  })

  const offset = Number(buf.readBigUInt64LE(0))
  t.is(offset, 2 * WORD_SIZE)

  const size = Number(buf.readBigUInt64LE(WORD_SIZE))
  t.is(size, 2 * SIZES[TYPES.float_le])

  const v1 = buf.readFloatLE(2 * WORD_SIZE + 0)
  t.is(v1, 8.5)

  const v2 = buf.readFloatLE(2 * WORD_SIZE + 4)
  t.is(v2, 6.5)
})

test('a pointer to an double_le array', async (t) => {
  const recordDef = [{ name: 'numbers', type: 'double_le_p' }]
  const compiled = compile(recordDef, { align: true })
  const buf = createRecord(compiled, {
    numbers: [4.2, 6.9],
  })

  const offset = Number(buf.readBigUInt64LE(0))
  t.is(offset, 2 * WORD_SIZE)

  const size = Number(buf.readBigUInt64LE(WORD_SIZE))
  t.is(size, 2 * SIZES[TYPES.double_le])

  const v1 = buf.readDoubleLE(2 * WORD_SIZE + 0)
  t.is(v1, 4.2)

  const v2 = buf.readDoubleLE(2 * WORD_SIZE + 8)
  t.is(v2, 6.9)
})

test('a cstring_p is written correctly', async (t) => {
  const recordDef = [{ name: 'str', type: 'cstring_p' }]
  const compiled = compile(recordDef, { align: true })
  const buf = createRecord(compiled, {
    str: 'hello world!',
  })

  const offset = buf.readBigUInt64LE(0)
  t.is(offset, BigInt(2 * WORD_SIZE))

  const size = buf.readBigUInt64LE(WORD_SIZE)
  t.is(size, BigInt('hello world!'.length))

  const str = buf
    .subarray(Number(offset), Number(offset) + Number(size))
    .toString('utf8')
  t.deepEqual(str, 'hello world!')
})

test('cstring_p NULL pointer', async (t) => {
  const recordDef = [{ name: 'str', type: 'cstring_p' }]
  const compiled = compile(recordDef, { align: true })
  const buf = createRecord(compiled, {
    str: null,
  })

  const offset = buf.readBigUInt64LE(0)
  t.is(offset, BigInt(0))

  const size = buf.readBigUInt64LE(WORD_SIZE)
  t.is(size, BigInt(0))

  t.is(buf.length, 2 * WORD_SIZE)
})

test('a complex record with pointers is written correctly', async (t) => {
  const recordDef = [
    { name: 'str1', type: 'cstring_p' },
    { name: 'num', type: 'int8' },
    { name: 'str2', type: 'cstring_p' },
  ]
  const compiled = compile(recordDef, { align: true })
  const buf = createRecord(compiled, {
    str1: 'hello',
    num: 13,
    str2: 'world',
  })

  const offset1 = Number(buf.readBigUInt64LE(0))
  t.is(offset1, 5 * WORD_SIZE)

  const size1 = Number(buf.readBigUInt64LE(WORD_SIZE))
  t.is(size1, 'hello'.length)

  const str1 = buf.subarray(offset1, offset1 + size1).toString('utf8')
  t.deepEqual(str1, 'hello')

  const num = buf.readInt8(2 * WORD_SIZE)
  t.is(num, 13)

  const offset2 = Number(buf.readBigUInt64LE(3 * WORD_SIZE))
  t.is(offset2, 5 * WORD_SIZE + 5 + 3)

  const size2 = Number(buf.readBigUInt64LE(4 * WORD_SIZE))
  t.is(size2, 5)

  const str2 = buf.subarray(offset2, offset2 + size2).toString('utf8')
  t.is(str2, 'world')
})

test('multiple integer arrays are written correctly to heap', async (t) => {
  const recordDef = [
    { name: 'nums1', type: 'uint32_le_p' },
    { name: 'nums2', type: 'int8_p' },
    { name: 'nums3', type: 'uint64_be_p' },
  ]
  const compiled = compile(recordDef, { align: true })
  const buf = createRecord(compiled, {
    nums1: [1, 2],
    nums2: [1, 2, 3],
    nums3: [BigInt('16045481047390994159')],
  })

  const offset1 = Number(buf.readBigUInt64LE(0))
  t.is(offset1, 3 * 2 * WORD_SIZE)

  const size1 = Number(buf.readBigUInt64LE(WORD_SIZE))
  t.is(size1, 2 * SIZES[TYPES.uint32_le])

  const offset2 = Number(buf.readBigUInt64LE(2 * WORD_SIZE))
  t.is(offset2, offset1 + size1)

  const size2 = Number(buf.readBigUInt64LE(3 * WORD_SIZE))
  t.is(size2, 3 * SIZES[TYPES.int8])

  const offset3 = Number(buf.readBigUInt64LE(4 * WORD_SIZE))
  t.is(offset3, compiled.align(offset2 + size2))

  const size3 = Number(buf.readBigUInt64LE(5 * WORD_SIZE))
  t.is(size3, SIZES[TYPES.uint64_le])
})

test('integers and doubles', async (t) => {
  const compiled = compile([
    { name: 'f1', type: 'int8' },
    { name: 'f2', type: 'int8' },
    { name: 'a', type: 'double_le_p' },
    { name: 'b', type: 'double_le_p' },
    { name: 'c', type: 'double_le_p' },
  ])
  const buf = createRecord(compiled, {
    f1: 1,
    f2: 0,
    a: null,
    b: null,
    c: [1.0, 7.0, 4.5, 8.2],
  })

  const offset1 = Number(buf.readBigUInt64LE(8))
  t.is(offset1, 0)

  const size1 = Number(buf.readBigUInt64LE(16))
  t.is(size1, 0)

  const offset3 = Number(buf.readBigUInt64LE(40))
  t.is(offset3, compiled.align(2 + 3 * 2 * WORD_SIZE))

  const value3 = [
    buf.readDoubleLE(offset3),
    buf.readDoubleLE(offset3 + 8),
    buf.readDoubleLE(offset3 + 16),
    buf.readDoubleLE(offset3 + 24),
  ]
  t.deepEqual(value3, [1, 7, 4.5, 8.2])
})

test('a pointer to a uint8 array is deserialized correctly', async (t) => {
  const recordDef = [{ name: 'numbers', type: 'uint8_p' }]
  const compiled = compile(recordDef, { align: true })
  const buf = Buffer.from(
    '100000000000000003000000000000000102030000000000',
    'hex'
  )
  const obj = deserialize(compiled, buf)

  t.deepEqual(obj, { numbers: [1, 2, 3] })
})

test('a pointer to a uint32_le array is deserialized correctly', async (t) => {
  const recordDef = [{ name: 'numbers', type: 'uint32_p' }]
  const compiled = compile(recordDef, { align: true })
  const buf = Buffer.from(
    '10000000000000000c0000000000000007014b070e02968e0e96020e00000000',
    'hex'
  )
  const obj = deserialize(compiled, buf)

  t.deepEqual(obj, { numbers: [122355975, 2392195598, 235050510] })
})

test('a pointer to a uint64_le array is deserialized correctly', async (t) => {
  const recordDef = [{ name: 'numbers', type: 'uint64_p' }]
  const compiled = compile(recordDef, { align: true })
  const buf = Buffer.from(
    '10000000000000001000000000000000f1d03aee8ea9542ba9561d5375dce2a1',
    'hex'
  )
  const obj = deserialize(compiled, buf)
  t.deepEqual(obj, {
    numbers: [BigInt('3122306873021878513'), BigInt('11665128381306721961')],
  })
})

test('a pointer to a float_le array is deserialized correctly', async (t) => {
  const recordDef = [{ name: 'numbers', type: 'float_p' }]
  const compiled = compile(recordDef, { align: true })
  const buf = Buffer.from(
    '10000000000000000800000000000000000008410000d040',
    'hex'
  )
  const obj = deserialize(compiled, buf)

  t.deepEqual(obj, { numbers: [8.5, 6.5] })
})

test('a pointer to a double_le array is deserialized correctly', async (t) => {
  const recordDef = [{ name: 'numbers', type: 'double_p' }]
  const compiled = compile(recordDef, { align: true })
  const buf = Buffer.from(
    '10000000000000001000000000000000cdcccccccccc10409a99999999991b40',
    'hex'
  )
  const obj = deserialize(compiled, buf)

  t.deepEqual(obj, { numbers: [4.2, 6.9] })
})

test('a cstring_p is deserialized', async (t) => {
  const recordDef = [{ name: 'str', type: 'cstring_p' }]
  const compiled = compile(recordDef, { align: true })
  const buf = Buffer.from(
    '10000000000000000c0000000000000068656c6c6f20776f726c642100000000',
    'hex'
  )
  const obj = deserialize(compiled, buf)

  t.deepEqual(obj, { str: 'hello world!' })
})

test('a cstring_p null pointer is deserialized', async (t) => {
  const recordDef = [{ name: 'str', type: 'cstring_p' }]
  const compiled = compile(recordDef, { align: true })
  const buf = Buffer.from('00000000000000000000000000000000', 'hex')
  const obj = deserialize(compiled, buf)

  t.deepEqual(obj, { str: null })
})

test('a complex record with pointers is deserialized correctly', async (t) => {
  const recordDef = [
    { name: 'str1', type: 'cstring_p' },
    { name: 'num', type: 'int8' },
    { name: 'str2', type: 'cstring_p' },
  ]
  const compiled = compile(recordDef, { align: true })
  const buf = Buffer.from(
    '280000000000000005000000000000000d000000000000003000000000000000050000000000000068656c6c6f000000776f726c64000000',
    'hex'
  )
  const obj = deserialize(compiled, buf)

  t.deepEqual(obj, {
    str1: 'hello',
    num: 13,
    str2: 'world',
  })
})

const recordDef2 = [
  { type: 'int8_p', name: 'a' },
  { type: 'int16_p', name: 'b' },
  { type: 'int16_be_p', name: 'c' },
  { type: 'int16_le_p', name: 'd' },
  { type: 'int32_p', name: 'e' },
  { type: 'int32_be_p', name: 'f' },
  { type: 'int32_le_p', name: 'g' },
  { type: 'int64_p', name: 'h' },
  { type: 'int64_be_p', name: 'i' },
  { type: 'int64_le_p', name: 'j' },
  { type: 'uint8_p', name: 'k' },
  { type: 'uint16_p', name: 'l' },
  { type: 'uint16_be_p', name: 'm' },
  { type: 'uint16_le_p', name: 'n' },
  { type: 'uint32_p', name: 'o' },
  { type: 'uint32_be_p', name: 'p' },
  { type: 'uint32_le_p', name: 'q' },
  { type: 'uint64_p', name: 'r' },
  { type: 'uint64_be_p', name: 's' },
  { type: 'uint64_le_p', name: 't' },
  { type: 'float_p', name: 'u' },
  { type: 'float_be_p', name: 'v' },
  { type: 'float_le_p', name: 'w' },
  { type: 'double_p', name: 'x' },
  { type: 'double_be_p', name: 'y' },
  { type: 'double_le_p', name: 'z' },
]
const compiled2 = compile(recordDef2)

test('Set and read int8 pointer', async (t) => {
  const buf = createRecord(compiled2, { a: [1] })
  const reader = createReader(compiled2, buf, '.a')
  t.deepEqual(reader(), [1])
})

test('Set and read int16 pointer', async (t) => {
  const buf = createRecord(compiled2, { b: [1] })
  const reader = createReader(compiled2, buf, '.b')
  t.deepEqual(reader(), [1])
})

test('Set and read int16_be pointer', async (t) => {
  const buf = createRecord(compiled2, { c: [1337] })
  const reader = createReader(compiled2, buf, '.c')
  t.deepEqual(reader(), [1337])
})

test('Set and read int16_le pointer', async (t) => {
  const buf = createRecord(compiled2, { d: [1337] })
  const reader = createReader(compiled2, buf, '.d')
  t.deepEqual(reader(), [1337])
})

test('Set and read int32 pointer', async (t) => {
  const buf = createRecord(compiled2, { e: [90000] })
  const reader = createReader(compiled2, buf, '.e')
  t.deepEqual(reader(), [90000])
})

test('Set and read int32_be pointer', async (t) => {
  const buf = createRecord(compiled2, { f: [90000] })
  const reader = createReader(compiled2, buf, '.f')
  t.deepEqual(reader(), [90000])
})

test('Set and read int32_le pointer', async (t) => {
  const buf = createRecord(compiled2, { g: [90000] })
  const reader = createReader(compiled2, buf, '.g')
  t.deepEqual(reader(), [90000])
})

test('Set and read int64 pointer', async (t) => {
  const buf = createRecord(compiled2, {
    h: [BigInt('288230376151801744')],
  })
  const reader = createReader(compiled2, buf, '.h')
  t.deepEqual(reader(), [BigInt('288230376151801744')])
})

test('Set and read int64_be pointer', async (t) => {
  const buf = createRecord(compiled2, {
    i: [BigInt('288230376151801744')],
  })
  const reader = createReader(compiled2, buf, '.i')
  t.deepEqual(reader(), [BigInt('288230376151801744')])
})

test('Set and read int64_le pointer', async (t) => {
  const buf = createRecord(compiled2, {
    j: [BigInt('288230376151801744')],
  })
  const reader = createReader(compiled2, buf, '.j')
  t.deepEqual(reader(), [BigInt('288230376151801744')])
})

test('Set and read uint8 pointer', async (t) => {
  const buf = createRecord(compiled2, { k: [136] })
  const reader = createReader(compiled2, buf, '.k')
  t.deepEqual(reader(), [136])
})

test('Set and read uint16 pointer', async (t) => {
  const buf = createRecord(compiled2, { l: [32904] })
  const reader = createReader(compiled2, buf, '.l')
  t.deepEqual(reader(), [32904])
})

test('Set and read uint16_be pointer', async (t) => {
  const buf = createRecord(compiled2, { m: [32904] })
  const reader = createReader(compiled2, buf, '.m')
  t.deepEqual(reader(), [32904])
})

test('Set and read uint16_le pointer', async (t) => {
  const buf = createRecord(compiled2, { n: [32904] })
  const reader = createReader(compiled2, buf, '.n')
  t.deepEqual(reader(), [32904])
})

test('Set and read uint32 pointer', async (t) => {
  const buf = createRecord(compiled2, { o: [2147483649] })
  const reader = createReader(compiled2, buf, '.o')
  t.deepEqual(reader(), [2147483649])
})

test('Set and read uint32_be pointer', async (t) => {
  const buf = createRecord(compiled2, { p: [2147483649] })
  const reader = createReader(compiled2, buf, '.p')
  t.deepEqual(reader(), [2147483649])
})

test('Set and read uint32_le pointer', async (t) => {
  const buf = createRecord(compiled2, { q: [2147483649] })
  const reader = createReader(compiled2, buf, '.q')
  t.deepEqual(reader(), [2147483649])
})

test('Set and read uint64 pointer', async (t) => {
  const buf = createRecord(compiled2, {
    r: [BigInt('9223372041149743104')],
  })
  const reader = createReader(compiled2, buf, '.r')
  t.deepEqual(reader(), [BigInt('9223372041149743104')])
})

test('Set and read uint64_be pointer', async (t) => {
  const buf = createRecord(compiled2, {
    s: [BigInt('9223372041149743104')],
  })
  const reader = createReader(compiled2, buf, '.s')
  t.deepEqual(reader(), [BigInt('9223372041149743104')])
})

test('Set and read uint64_le pointer', async (t) => {
  const buf = createRecord(compiled2, {
    t: [BigInt('9223372041149743104')],
  })
  const reader = createReader(compiled2, buf, '.t')
  t.deepEqual(reader(), [BigInt('9223372041149743104')])
})

test('Set and read float pointer', async (t) => {
  const buf = createRecord(compiled2, { u: [1.5] })
  const reader = createReader(compiled2, buf, '.u')
  t.deepEqual(reader(), [1.5])
})

test('Set and read float_be pointer', async (t) => {
  const buf = createRecord(compiled2, { v: [1.5] })
  const reader = createReader(compiled2, buf, '.v')
  t.deepEqual(reader(), [1.5])
})

test('Set and read float_le pointer', async (t) => {
  const buf = createRecord(compiled2, { w: [1.5] })
  const reader = createReader(compiled2, buf, '.w')
  t.deepEqual(reader(), [1.5])
})

test('Set and read double pointer', async (t) => {
  const buf = createRecord(compiled2, { x: [1.5] })
  const reader = createReader(compiled2, buf, '.x')
  t.deepEqual(reader(), [1.5])
})

test('Set and read double_be pointer', async (t) => {
  const buf = createRecord(compiled2, { y: [1.5] })
  const reader = createReader(compiled2, buf, '.y')
  t.deepEqual(reader(), [1.5])
})

test('Set and read double_le pointer', async (t) => {
  const buf = createRecord(compiled2, { z: [1.5] })
  const reader = createReader(compiled2, buf, '.z')
  t.deepEqual(reader(), [1.5])
})

test('Reader returns null pointer for every pointer in buf', async (t) => {
  const recordDef = [
    { type: 'int8_p', name: 'a' },
    { type: 'int16_p', name: 'b' },
    { type: 'int16_be_p', name: 'c' },
    { type: 'int16_le_p', name: 'd' },
    { type: 'int32_p', name: 'e' },
    { type: 'int32_be_p', name: 'f' },
    { type: 'int32_le_p', name: 'g' },
    { type: 'int64_p', name: 'h' },
    { type: 'int64_be_p', name: 'i' },
    { type: 'int64_le_p', name: 'j' },
    { type: 'uint8_p', name: 'k' },
    { type: 'uint16_p', name: 'l' },
    { type: 'uint16_be_p', name: 'm' },
    { type: 'uint16_le_p', name: 'n' },
    { type: 'uint32_p', name: 'o' },
    { type: 'uint32_be_p', name: 'p' },
    { type: 'uint32_le_p', name: 'q' },
    { type: 'uint64_p', name: 'r' },
    { type: 'uint64_be_p', name: 's' },
    { type: 'uint64_le_p', name: 't' },
    { type: 'float_p', name: 'u' },
    { type: 'float_be_p', name: 'v' },
    { type: 'float_le_p', name: 'w' },
    { type: 'double_p', name: 'x' },
    { type: 'double_be_p', name: 'y' },
    { type: 'double_le_p', name: 'z' },
  ]
  const compiled = compile(recordDef)
  const buf = createRecord(compiled, {})
  t.is(readValue(compiled, buf, '.a'), null)
  t.is(readValue(compiled, buf, '.b'), null)
  t.is(readValue(compiled, buf, '.c'), null)
  t.is(readValue(compiled, buf, '.d'), null)
  t.is(readValue(compiled, buf, '.e'), null)
  t.is(readValue(compiled, buf, '.f'), null)
  t.is(readValue(compiled, buf, '.g'), null)
  t.is(readValue(compiled, buf, '.h'), null)
  t.is(readValue(compiled, buf, '.i'), null)
  t.is(readValue(compiled, buf, '.j'), null)
  t.is(readValue(compiled, buf, '.k'), null)
  t.is(readValue(compiled, buf, '.l'), null)
  t.is(readValue(compiled, buf, '.m'), null)
  t.is(readValue(compiled, buf, '.n'), null)
  t.is(readValue(compiled, buf, '.o'), null)
  t.is(readValue(compiled, buf, '.p'), null)
  t.is(readValue(compiled, buf, '.q'), null)
  t.is(readValue(compiled, buf, '.r'), null)
  t.is(readValue(compiled, buf, '.s'), null)
  t.is(readValue(compiled, buf, '.t'), null)
  t.is(readValue(compiled, buf, '.u'), null)
  t.is(readValue(compiled, buf, '.v'), null)
  t.is(readValue(compiled, buf, '.w'), null)
  t.is(readValue(compiled, buf, '.x'), null)
  t.is(readValue(compiled, buf, '.y'), null)
  t.is(readValue(compiled, buf, '.z'), null)
})

const recordDef4 = [{ name: 'str', type: 'cstring_p' }]
const compiled4 = compile(recordDef4)

test('Set string value', async (t) => {
  const buf = createRecord(compiled4, { str: 'abc' })
  t.is(readString(compiled4, buf, '.str', 'utf8'), 'abc')
})

test('Set string value as a buffer', async (t) => {
  const buf = createRecord(compiled4, { str: Buffer.from('hello') })
  t.is(readString(compiled4, buf, '.str', 'utf8'), 'hello')
})

test('Null pointer', async (t) => {
  const buf = createRecord(compiled4, { str: null })
  t.is(readString(compiled4, buf, '.str', 'utf8'), null)
})
