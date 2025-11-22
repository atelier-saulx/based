import { deepEqual, equal } from 'node:assert'
import test from './shared/test.js'
import native from '../src/native.js'

await test('string byteLength', async (t) => {
  equal(native.stringByteLength(''), 0)
  equal(native.stringByteLength('hello'), 5)
  // @ts-ignore
  equal(native.stringByteLength(null), 0)
})

await test('string to buffer', async (t) => {
  const buf1 = new Uint8Array(5)
  const buf2 = new Uint8Array(6)
  const buf3 = new Uint8Array([1, 2, 0, 0, 0, 0, 3, 4])

  const res1 = native.stringToUint8Array('hello', buf1)
  const res2 = native.stringToUint8Array('hello', buf2, 0, true)
  const res3 = native.stringToUint8Array('hell', buf3, 2, false)

  equal(res1, 5)
  deepEqual([...buf1], [104, 101, 108, 108, 111])
  deepEqual([...buf2], [104, 101, 108, 108, 111, 0])
  equal(res2, 5)
  deepEqual([...buf3], [1, 2, 104, 101, 108, 108, 3, 4])
  equal(res3, 4)
})
