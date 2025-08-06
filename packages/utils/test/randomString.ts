import test from 'ava'
import { randomString } from '../src/index.js'

test('randomString', (t) => {
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

  t.assert(one.length === l)
  t.assert(two.length === l)
  t.assert(three.length === l)
  t.assert(four.length === l)
  t.assert(five.length === l)

  t.assert(
    upperCaseChars.split('').some((v) => {
      return (
        one.indexOf(v) >= 0 &&
        two.indexOf(v) >= 0 &&
        three.indexOf(v) >= 0 &&
        four.indexOf(v) < 0 &&
        five.indexOf(v) >= 0
      )
    })
  )

  t.assert(
    lowerCaseChars.split('').some((v) => {
      return (
        one.indexOf(v) >= 0 &&
        two.indexOf(v) >= 0 &&
        three.indexOf(v) < 0 &&
        four.indexOf(v) >= 0 &&
        five.indexOf(v) >= 0
      )
    })
  )

  t.assert(
    numberChars.split('').some((v) => {
      return (
        one.indexOf(v) >= 0 &&
        two.indexOf(v) >= 0 &&
        three.indexOf(v) >= 0 &&
        four.indexOf(v) >= 0 &&
        five.indexOf(v) < 0
      )
    })
  )

  t.assert(
    specialsChars.split('').some((v) => {
      return (
        one.indexOf(v) >= 0 &&
        two.indexOf(v) < 0 &&
        three.indexOf(v) >= 0 &&
        four.indexOf(v) >= 0 &&
        five.indexOf(v) >= 0
      )
    })
  )
})
