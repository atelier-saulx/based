import assert from 'node:assert'
import { randomString } from '../../src/utils/index.js'
import { test } from '../shared/index.js'

await test('randomString', async (t) => {
  const upperCaseChars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'
  const lowerCaseChars = 'abcdefghijklmnopqrstuvwxyz'
  const numberChars = '0123456789'
  const specialsChars = '!"#$%&\'()*+,-./:;<=>?@[\\]^_`{|}~'

  const l = 2000

  const one = randomString(l)
  const two = randomString(l, { noSpecials: true })
  const three = randomString(l, { noLowerCase: true })
  const four = randomString(l, { noUpperCase: true })
  const five = randomString(l, { noNumbers: true })

  assert(one.length === l)
  assert(two.length === l)
  assert(three.length === l)
  assert(four.length === l)
  assert(five.length === l)

  assert(
    upperCaseChars.split('').some((v) => {
      return (
        one.indexOf(v) >= 0 &&
        two.indexOf(v) >= 0 &&
        three.indexOf(v) >= 0 &&
        four.indexOf(v) < 0 &&
        five.indexOf(v) >= 0
      )
    }),
  )

  assert(
    lowerCaseChars.split('').some((v) => {
      return (
        one.indexOf(v) >= 0 &&
        two.indexOf(v) >= 0 &&
        three.indexOf(v) < 0 &&
        four.indexOf(v) >= 0 &&
        five.indexOf(v) >= 0
      )
    }),
  )

  assert(
    numberChars.split('').some((v) => {
      return (
        one.indexOf(v) >= 0 &&
        two.indexOf(v) >= 0 &&
        three.indexOf(v) >= 0 &&
        four.indexOf(v) >= 0 &&
        five.indexOf(v) < 0
      )
    }),
  )

  assert(
    specialsChars.split('').some((v) => {
      return (
        one.indexOf(v) >= 0 &&
        two.indexOf(v) < 0 &&
        three.indexOf(v) >= 0 &&
        four.indexOf(v) >= 0 &&
        five.indexOf(v) >= 0
      )
    }),
  )
})
