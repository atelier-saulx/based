import test from 'ava'
import { padLeft, padRight } from '../src/index.js'

test('padding', async (t) => {
  const x = padLeft('a', 4, 'b')
  t.is(x, 'bbba')
  const y = padRight('a', 4, 'b')
  t.is(y, 'abbb')
})
