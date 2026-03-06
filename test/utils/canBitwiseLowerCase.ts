import assert from 'node:assert'
import { canBitwiseLowerCase } from '../../src/utils/index.js'
import { test } from '../shared/index.js'

await test('canBitwiseLowerCase ', async (t) => {
  // Safe: digits, letters
  assert(canBitwiseLowerCase('abcde99') === true)
  assert(canBitwiseLowerCase('ABCDE99') === true)

  // Safe: JSON string, brackets that have the 32 bit set
  assert(canBitwiseLowerCase('{"bla": true}') === true)
  assert(canBitwiseLowerCase('! "#$%&\'()*+,-./:;<=>?{|}~') === true)

  // Unsafe: characters without the 32 bit set, other than A-Z
  // @ (64) -> ` (96)
  assert(canBitwiseLowerCase('mrflapperde@co') === false)
  // [ (91) -> { (123)
  assert(canBitwiseLowerCase('arr[0]') === false)
  // \ (92) -> | (124)
  assert(canBitwiseLowerCase('path\\to') === false)
  // ] (93) -> } (125)
  assert(canBitwiseLowerCase('arr]') === false)
  // ^ (94) -> ~ (126)
  assert(canBitwiseLowerCase('hello^') === false)
  // _ (95) -> DEL (127)
  assert(canBitwiseLowerCase('some_var') === false)
  // Control characters: \n (10), \t (9)
  assert(canBitwiseLowerCase('multi\nline') === false)
  assert(canBitwiseLowerCase('tab\tbed') === false)
})
