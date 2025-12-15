import { getType } from '../../src/utils/index.js'
import { equal, test } from '../shared/index.js'

await test('getType', async (t) => {
  equal(getType(''), 'string')
  equal(getType('this is a string'), 'string')
  equal(getType(123), 'number')
  equal(getType(12.3), 'number')
  equal(getType(-12.3), 'number')
  equal(getType(-123), 'number')
  equal(getType(BigInt('1')), 'bigint')
  equal(getType(true), 'boolean')
  equal(getType(false), 'boolean')
  equal(getType(undefined), 'undefined')
  equal(getType({}), 'object')
  equal(getType({ a: 'wawa' }), 'object')
  equal(
    getType(() => {}),
    'function',
  )
  equal(getType([]), 'array')
  equal(getType([1, 2, 3]), 'array')
  equal(getType(null), 'null')
})
