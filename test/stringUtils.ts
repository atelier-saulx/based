import { equal } from 'node:assert'
import test from './shared/test.js'
import native from '../src/native.js'

await test('string byteLength', async (t) => {
  equal(native.stringByteLength(''), 0)
  equal(native.stringByteLength('hello'), 5)
  // @ts-ignore
  equal(native.stringByteLength(null), 0)
})
