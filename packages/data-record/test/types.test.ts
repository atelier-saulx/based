import {
  compile,
  allocRecord,
  writeValue,
  readValue,
  readString,
  ENDIANNESS,
  WORD_SIZE,
} from '../src/index.js'
import test from 'ava'

test('int8 - #2', async (t) => {
  const def = [{ name: 'a', type: 'int8' }]
  const compiled = compile(def, { align: false })
  const buf = allocRecord(compiled)
  writeValue(compiled, buf, '.a', -127)
  t.is(buf.toString('hex'), '81')
})

test('int16 - #2', (t) => {
  const def = [{ name: 'a', type: 'int16' }]
  const compiled = compile(def, { align: false })
  const buf = allocRecord(compiled)
  writeValue(compiled, buf, '.a', 0x1234)
  if (ENDIANNESS === 'BE') {
    t.is(buf.toString('hex'), '1234')
  } else {
    t.is(buf.toString('hex'), '3412')
  }
})

test('int16_be #2', (t) => {
  const def = [{ name: 'a', type: 'int16_be' }]
  const compiled = compile(def, { align: false })
  const buf = allocRecord(compiled)
  writeValue(compiled, buf, '.a', 0x1234)
  t.is(buf.toString('hex'), '1234')
})

test('int16_le #2', (t) => {
  const def = [{ name: 'a', type: 'int16_le' }]
  const compiled = compile(def, { align: false })
  const buf = allocRecord(compiled)

  writeValue(compiled, buf, '.a', 0x1234)
  t.is(buf.toString('hex'), '3412')
})

test('int32 #2', (t) => {
  const def = [{ name: 'a', type: 'int32' }]
  const compiled = compile(def, { align: false })
  const buf = allocRecord(compiled)

  writeValue(compiled, buf, '.a', 0x12345678)
  if (ENDIANNESS === 'BE') {
    t.is(buf.toString('hex'), '12345678')
  } else {
    t.is(buf.toString('hex'), '78563412')
  }
})

test('int32_be #2', (t) => {
  const def = [{ name: 'a', type: 'int32_be' }]
  const compiled = compile(def, { align: false })
  const buf = allocRecord(compiled)

  writeValue(compiled, buf, '.a', 0x12345678)
  t.is(buf.toString('hex'), '12345678')
})

test('int32_le #2', (t) => {
  const def = [{ name: 'a', type: 'int32_le' }]
  const compiled = compile(def, { align: false })
  const buf = allocRecord(compiled)

  writeValue(compiled, buf, '.a', 0x12345678)
  t.is(buf.toString('hex'), '78563412')
})

test('int64 #2', (t) => {
  const def = [{ name: 'a', type: 'int64' }]
  const compiled = compile(def, { align: false })
  const buf = allocRecord(compiled)

  writeValue(compiled, buf, '.a', BigInt('0xdeface0deadbeef'))
  if (ENDIANNESS === 'BE') {
    t.is(buf.toString('hex'), '0deface0deadbeef')
  } else {
    t.is(buf.toString('hex'), 'efbeaddee0acef0d')
  }
})

test('int64_be #2', (t) => {
  const def = [{ name: 'a', type: 'int64_be' }]
  const compiled = compile(def, { align: false })
  const buf = allocRecord(compiled)

  writeValue(compiled, buf, '.a', BigInt('0xdeface0deadbeef'))
  t.is(buf.toString('hex'), '0deface0deadbeef')
})

test('int64_le #2', (t) => {
  const def = [{ name: 'a', type: 'int64_le' }]
  const compiled = compile(def, { align: false })
  const buf = allocRecord(compiled)

  writeValue(compiled, buf, '.a', BigInt('0xdeface0deadbeef'))
  t.is(buf.toString('hex'), 'efbeaddee0acef0d')
})

test('uint8 #2', (t) => {
  const def = [{ name: 'a', type: 'uint8' }]
  const compiled = compile(def, { align: false })
  const buf = allocRecord(compiled)

  writeValue(compiled, buf, '.a', 254)
  t.is(buf.toString('hex'), 'fe')
})

test('uint16 #2', (t) => {
  const def = [{ name: 'a', type: 'uint16' }]
  const compiled = compile(def, { align: false })
  const buf = allocRecord(compiled)

  writeValue(compiled, buf, '.a', 0x1234)
  if (ENDIANNESS === 'BE') {
    t.is(buf.toString('hex'), '1234')
  } else {
    t.is(buf.toString('hex'), '3412')
  }
})

test('uint16_be #2', (t) => {
  const def = [{ name: 'a', type: 'uint16_be' }]
  const compiled = compile(def, { align: false })
  const buf = allocRecord(compiled)

  writeValue(compiled, buf, '.a', 0x1234)
  t.is(buf.toString('hex'), '1234')
})

test('uint16_le #2', (t) => {
  const def = [{ name: 'a', type: 'uint16_le' }]
  const compiled = compile(def, { align: false })
  const buf = allocRecord(compiled)

  writeValue(compiled, buf, '.a', 0x1234)
  t.is(buf.toString('hex'), '3412')
})

test('uint32 #2', (t) => {
  const def = [{ name: 'a', type: 'uint32' }]
  const compiled = compile(def, { align: false })
  const buf = allocRecord(compiled)

  writeValue(compiled, buf, '.a', 0x12345678)
  if (ENDIANNESS === 'BE') {
    t.is(buf.toString('hex'), '12345678')
  } else {
    t.is(buf.toString('hex'), '78563412')
  }
})

test('uint32_be #2', (t) => {
  const def = [{ name: 'a', type: 'uint32_be' }]
  const compiled = compile(def, { align: false })
  const buf = allocRecord(compiled)

  writeValue(compiled, buf, '.a', 0x12345678)
  t.is(buf.toString('hex'), '12345678')
})

test('uint32_le #2', (t) => {
  const def = [{ name: 'a', type: 'uint32_le' }]
  const compiled = compile(def, { align: false })
  const buf = allocRecord(compiled)

  writeValue(compiled, buf, '.a', 0x12345678)
  t.is(buf.toString('hex'), '78563412')
})

test('uint64 #2', (t) => {
  const def = [{ name: 'a', type: 'uint64' }]
  const compiled = compile(def, { align: false })
  const buf = allocRecord(compiled)

  writeValue(compiled, buf, '.a', BigInt('0xdeface0deadbeef'))
  if (ENDIANNESS === 'BE') {
    t.is(buf.toString('hex'), '0deface0deadbeef')
  } else {
    t.is(buf.toString('hex'), 'efbeaddee0acef0d')
  }
})

test('uint64_be #2', (t) => {
  const def = [{ name: 'a', type: 'uint64_be' }]
  const compiled = compile(def, { align: false })
  const buf = allocRecord(compiled)

  writeValue(compiled, buf, '.a', BigInt('0xdeface0deadbeef'))
  t.is(buf.toString('hex'), '0deface0deadbeef')
})

test('uint64_le #2', (t) => {
  const def = [{ name: 'a', type: 'uint64_le' }]
  const compiled = compile(def, { align: false })
  const buf = allocRecord(compiled)

  writeValue(compiled, buf, '.a', BigInt('0xdeface0deadbeef'))
  t.is(buf.toString('hex'), 'efbeaddee0acef0d')
})

test('float #2', (t) => {
  const def = [{ name: 'a', type: 'float' }]
  const compiled = compile(def, { align: false })
  const buf = allocRecord(compiled)

  writeValue(compiled, buf, '.a', 1.5)
  if (ENDIANNESS === 'BE') {
    t.is(buf.readFloatBE(), 1.5)
  } else {
    t.is(buf.readFloatLE(), 1.5)
  }
})

test('float_be #2', (t) => {
  const def = [{ name: 'a', type: 'float_be' }]
  const compiled = compile(def, { align: false })
  const buf = allocRecord(compiled)

  writeValue(compiled, buf, '.a', 1.5)
  t.is(buf.readFloatBE(), 1.5)
})

test('float_le #2', (t) => {
  const def = [{ name: 'a', type: 'float_le' }]
  const compiled = compile(def, { align: false })
  const buf = allocRecord(compiled)

  writeValue(compiled, buf, '.a', 1.5)
  t.is(buf.readFloatLE(), 1.5)
})

test('double #2', (t) => {
  const def = [{ name: 'a', type: 'double' }]
  const compiled = compile(def, { align: false })
  const buf = allocRecord(compiled)

  writeValue(compiled, buf, '.a', 1.2345)
  if (ENDIANNESS === 'BE') {
    t.is(buf.readDoubleBE(), 1.2345)
  } else {
    t.is(buf.readDoubleLE(), 1.2345)
  }
})

test('double_be #2', (t) => {
  const def = [{ name: 'a', type: 'double_be' }]
  const compiled = compile(def, { align: false })
  const buf = allocRecord(compiled)

  writeValue(compiled, buf, '.a', 1.2345)
  t.is(buf.readDoubleBE(), 1.2345)
})

test('double_le #2', (t) => {
  const def = [{ name: 'a', type: 'double_le' }]
  const compiled = compile(def, { align: false })
  const buf = allocRecord(compiled)

  writeValue(compiled, buf, '.a', 1.2345)
  t.is(buf.readDoubleLE(), 1.2345)
})

test('cstring #2', (t) => {
  const def = [{ name: 'a', type: 'cstring', size: 5 }]
  const compiled = compile(def, { align: false })
  const buf = allocRecord(compiled)

  writeValue(compiled, buf, '.a', 'hello')
  t.is(buf.toString('utf8'), 'hello')
})

//'Test that each type reads the correct value'
test('int8', (t) => {
  const def = [{ name: 'a', type: 'int8' }]
  const compiled = compile(def, { align: false })
  const buf = Buffer.from('81', 'hex')
  t.is(buf.length, 1)
  const value = readValue(compiled, buf, '.a')
  t.is(value, -127)
})

test('int16', (t) => {
  const def = [{ name: 'a', type: 'int16' }]
  const compiled = compile(def, { align: false })
  const buf = Buffer.from('1234', 'hex')
  t.is(buf.length, 2)

  const value = readValue(compiled, buf, '.a')
  if (ENDIANNESS === 'BE') {
    t.is(value, 0x1234)
  } else {
    t.is(value, 0x3412)
  }
})

test('int16_be', (t) => {
  const def = [{ name: 'a', type: 'int16_be' }]
  const compiled = compile(def, { align: false })
  const buf = Buffer.from('1234', 'hex')
  t.is(buf.length, 2)

  const value = readValue(compiled, buf, '.a')
  t.is(value, 0x1234)
})

test('int16_le', (t) => {
  const def = [{ name: 'a', type: 'int16_le' }]
  const compiled = compile(def, { align: false })
  const buf = Buffer.from('1234', 'hex')
  t.is(buf.length, 2)

  const value = readValue(compiled, buf, '.a')
  t.is(value, 0x3412)
})

test('int32', (t) => {
  const def = [{ name: 'a', type: 'int32' }]
  const compiled = compile(def, { align: false })
  const buf = Buffer.from('12345678', 'hex')
  t.is(buf.length, 4)

  const value = readValue(compiled, buf, '.a')
  if (ENDIANNESS === 'BE') {
    t.is(value, 0x12345678)
  } else {
    t.is(value, 0x78563412)
  }
})

test('int32_be', (t) => {
  const def = [{ name: 'a', type: 'int32_be' }]
  const compiled = compile(def, { align: false })
  const buf = Buffer.from('12345678', 'hex')
  t.is(buf.length, 4)

  const value = readValue(compiled, buf, '.a')
  t.is(value, 0x12345678)
})

test('int32_le', (t) => {
  const def = [{ name: 'a', type: 'int32_le' }]
  const compiled = compile(def, { align: false })
  const buf = Buffer.from('12345678', 'hex')
  t.is(buf.length, 4)

  const value = readValue(compiled, buf, '.a')
  t.is(value, 0x78563412)
})

test('int64', (t) => {
  const def = [{ name: 'a', type: 'int64' }]
  const compiled = compile(def, { align: false })
  const buf = Buffer.from('000000ba55000000', 'hex')
  t.is(buf.length, 8)

  const value = readValue(compiled, buf, '.a')
  if (ENDIANNESS === 'BE') {
    t.is(value, BigInt('0xba55000000'))
  } else {
    t.is(value, BigInt('0x55ba000000'))
  }
})

test('int64_be', (t) => {
  const def = [{ name: 'a', type: 'int64_be' }]
  const compiled = compile(def, { align: false })
  const buf = Buffer.from('0deface0deadbeef', 'hex')
  t.is(buf.length, 8)

  const value = readValue(compiled, buf, '.a')
  t.is(value, BigInt('0xdeface0deadbeef'))
})

test('int64_le', (t) => {
  const def = [{ name: 'a', type: 'int64_le' }]
  const compiled = compile(def, { align: false })
  const buf = Buffer.from('efbeaddee0acef0d', 'hex')
  t.is(buf.length, 8)

  const value = readValue(compiled, buf, '.a')
  t.is(value, BigInt('0xdeface0deadbeef'))
})

test('uint8', (t) => {
  const def = [{ name: 'a', type: 'uint8' }]
  const compiled = compile(def, { align: false })
  const buf = Buffer.from('fe', 'hex')
  t.is(buf.length, 1)

  const value = readValue(compiled, buf, '.a')
  t.is(value, 254)
})

test('uint16', (t) => {
  const def = [{ name: 'a', type: 'uint16' }]
  const compiled = compile(def, { align: false })
  const buf = Buffer.from('1234', 'hex')
  t.is(buf.length, 2)

  const value = readValue(compiled, buf, '.a')
  if (ENDIANNESS === 'BE') {
    t.is(value, 0x1234)
  } else {
    t.is(value, 0x3412)
  }
})

test('uint16_be', (t) => {
  const def = [{ name: 'a', type: 'uint16_be' }]
  const compiled = compile(def, { align: false })
  const buf = Buffer.from('1234', 'hex')
  t.is(buf.length, 2)

  const value = readValue(compiled, buf, '.a')
  t.is(value, 0x1234)
})

test('uint16_le', (t) => {
  const def = [{ name: 'a', type: 'uint16_le' }]
  const compiled = compile(def, { align: false })
  const buf = Buffer.from('1234', 'hex')
  t.is(buf.length, 2)

  const value = readValue(compiled, buf, '.a')
  t.is(value, 0x3412)
})

test('uint32', (t) => {
  const def = [{ name: 'a', type: 'uint32' }]
  const compiled = compile(def, { align: false })
  const buf = Buffer.from('12345678', 'hex')
  t.is(buf.length, 4)

  const value = readValue(compiled, buf, '.a')
  if (ENDIANNESS === 'BE') {
    t.is(value, 0x12345678)
  } else {
    t.is(value, 0x78563412)
  }
})

test('uint32_be', (t) => {
  const def = [{ name: 'a', type: 'uint32_be' }]
  const compiled = compile(def, { align: false })
  const buf = Buffer.from('12345678', 'hex')
  t.is(buf.length, 4)

  const value = readValue(compiled, buf, '.a')
  t.is(value, 0x12345678)
})

test('uint32_le', (t) => {
  const def = [{ name: 'a', type: 'uint32_le' }]
  const compiled = compile(def, { align: false })
  const buf = Buffer.from('12345678', 'hex')
  t.is(buf.length, 4)

  const value = readValue(compiled, buf, '.a')
  t.is(value, 0x78563412)
})

test('uint64', (t) => {
  const def = [{ name: 'a', type: 'uint64' }]
  const compiled = compile(def, { align: false })
  const buf = Buffer.from('0deface0deadbeef', 'hex')
  t.is(buf.length, 8)

  const value = readValue(compiled, buf, '.a')
  if (ENDIANNESS === 'BE') {
    t.is(value, BigInt('0xdeface0deadbeef'))
  } else {
    t.is(value, BigInt('0xefbeaddee0acef0d'))
  }
})

test('uint64_be', (t) => {
  const def = [{ name: 'a', type: 'uint64_be' }]
  const compiled = compile(def, { align: false })
  const buf = Buffer.from('0deface0deadbeef', 'hex')
  t.is(buf.length, 8)

  const value = readValue(compiled, buf, '.a')
  t.is(value, BigInt('0xdeface0deadbeef'))
})

test('uint64_le', (t) => {
  const def = [{ name: 'a', type: 'uint64_le' }]
  const compiled = compile(def, { align: false })
  const buf = Buffer.from('0deface0deadbeef', 'hex')
  t.is(buf.length, 8)

  const value = readValue(compiled, buf, '.a')
  t.is(value, BigInt('0xefbeaddee0acef0d'))
})

test('float', (t) => {
  const def = [{ name: 'a', type: 'float' }]
  const compiled = compile(def, { align: false })
  const buf = Buffer.from(ENDIANNESS === 'BE' ? '3fc00000' : '0000c03f', 'hex')
  t.is(buf.length, 4)

  const value = readValue(compiled, buf, '.a')
  t.is(value, 1.5)
})

test('float_be', (t) => {
  const def = [{ name: 'a', type: 'float_be' }]
  const compiled = compile(def, { align: false })
  const buf = Buffer.from('3fc00000', 'hex')
  t.is(buf.length, 4)

  const value = readValue(compiled, buf, '.a')
  t.is(value, 1.5)
})

test('float_le', (t) => {
  const def = [{ name: 'a', type: 'float_le' }]
  const compiled = compile(def, { align: false })
  const buf = Buffer.from('0000c03f', 'hex')
  t.is(buf.length, 4)

  const value = readValue(compiled, buf, '.a')
  t.is(value, 1.5)
})

test('double', (t) => {
  const def = [{ name: 'a', type: 'double' }]
  const compiled = compile(def, { align: false })
  const buf = Buffer.from(
    ENDIANNESS === 'BE' ? '3ff3c083126e978d' : '8d976e1283c0f33f',
    'hex'
  )
  t.is(buf.length, 8)

  const value = readValue(compiled, buf, '.a')
  t.is(value, 1.2345)
})

test('double_be', (t) => {
  const def = [{ name: 'a', type: 'double_be' }]
  const compiled = compile(def, { align: false })
  const buf = Buffer.from('3ff3c083126e978d', 'hex')
  t.is(buf.length, 8)

  const value = readValue(compiled, buf, '.a')
  t.is(value, 1.2345)
})

test('double_le', (t) => {
  const def = [{ name: 'a', type: 'double_le' }]
  const compiled = compile(def, { align: false })
  const buf = Buffer.from('8d976e1283c0f33f', 'hex')
  t.is(buf.length, 8)

  const value = readValue(compiled, buf, '.a')
  t.is(value, 1.2345)
})

test('cstring', (t) => {
  const def = [{ name: 'a', type: 'cstring', size: 5 }]
  const compiled = compile(def, { align: false })
  const buf = Buffer.from('hello')

  const value = readString(compiled, buf, '.a', 'utf8')
  t.is(value, 'hello')
})

test('cstring_p', (t) => {
  if (WORD_SIZE !== 8) {
    console.error('This test is 64-bit only')
  }

  const def = [{ name: 'a', type: 'cstring_p' }]
  const compiled = compile(def, { align: false })
  const buf = Buffer.from('1000000000000000050000000000000068656c6c6f', 'hex')

  const value = readString(compiled, buf, '.a', 'utf8')
  t.is(value, 'hello')
})
