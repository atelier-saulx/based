import {
  compile,
  createRecord,
  readValue,
  readString,
  writeString,
} from '../src/index.js'
import test from 'ava'

const CANARY = 0xffffffff

const recordDef = [
  { name: 'str', type: 'cstring', size: 5 },
  { name: 'canary', type: 'uint32_le' },
]

const compiled = compile(recordDef, { align: false })

test("Test that a normal string write doesn't overwrite", (t) => {
  const buf = createRecord(compiled, { str: 'abc', canary: CANARY })
  t.is(readString(compiled, buf, '.str', 'utf8'), 'abc')
  t.is(readValue(compiled, buf, '.canary'), CANARY)
})

test('Test that max length string works', (t) => {
  const buf = createRecord(compiled, { str: 'abcde', canary: CANARY })
  t.is(readString(compiled, buf, '.str', 'utf8'), 'abcde')
  t.is(readValue(compiled, buf, '.canary'), CANARY)
})

test("Test that a too long string doesn't overwrite", (t) => {
  const buf = createRecord(compiled, { str: 'abcdef', canary: CANARY })
  t.is(readString(compiled, buf, '.str', 'utf8'), 'abcde')
  t.is(readValue(compiled, buf, '.canary'), CANARY)
})

test('writeString() zeroes the rest', (t) => {
  const buf = createRecord(compiled, { str: '', canary: CANARY })
  writeString(compiled, buf, '.str', 'a')
  const read = readString(compiled, buf, '.str', 'hex')
  t.is(read, '6100000000')
})

test('writeString() returns the string len written', (t) => {
  const buf = createRecord(compiled, { str: '', canary: CANARY })
  const written = writeString(compiled, buf, '.str', 'abc')
  t.is(written, 3)
})

test('writeString() returns less than string length for too long string', (t) => {
  const buf = createRecord(compiled, { str: '', canary: CANARY })
  const written = writeString(compiled, buf, '.str', 'abcdef')
  t.is(written, 5)
})

test('readValue() returns a proper buffer for a string', (t) => {
  const buf = createRecord(compiled, { str: 'a', canary: CANARY })
  const read = readValue<Buffer>(compiled, buf, '.str')
  t.truthy(Buffer.isBuffer(read))
  t.is(read.toString('hex'), '6100000000')
})

test('readString() with no encoding returns a proper buffer', (t) => {
  const buf = createRecord(compiled, { str: 'a', canary: CANARY })
  const read = readString(compiled, buf, '.str')
  t.truthy(Buffer.isBuffer(read))
  t.is(read.toString('hex'), '6100000000')
})

test("readString() with 'utf8' returns a proper string", (t) => {
  const buf = createRecord(compiled, { str: 'ä', canary: CANARY })
  const read = readString(compiled, buf, '.str', 'utf8')
  t.is(read, 'ä')
})

test("readString() with 'ascii' returns a proper string", (t) => {
  const buf = createRecord(compiled, { str: 'a', canary: CANARY })
  const read = readString(compiled, buf, '.str', 'ascii')
  t.is(read, 'a')
})
