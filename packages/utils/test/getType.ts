import test from 'ava'
import { getType } from '../src/index.js'

test('getType', (t) => {
  t.is(getType(''), 'string')
  t.is(getType('this is a string'), 'string')
  t.is(getType(123), 'number')
  t.is(getType(12.3), 'number')
  t.is(getType(-12.3), 'number')
  t.is(getType(-123), 'number')
  t.is(getType(BigInt('1')), 'bigint')
  t.is(getType(true), 'boolean')
  t.is(getType(false), 'boolean')
  t.is(getType(undefined), 'undefined')
  t.is(getType({}), 'object')
  t.is(getType({ a: 'wawa' }), 'object')
  t.is(
    getType(() => {}),
    'function'
  )
  t.is(getType([]), 'array')
  t.is(getType([1, 2, 3]), 'array')
  t.is(getType(null), 'null')
})
