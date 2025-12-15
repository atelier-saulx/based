import { padLeft, padRight } from '../../src/utils/index.js'
import { equal, test } from '../shared/index.js'

await test('padding', async (t) => {
  const x = padLeft('a', 4, 'b')
  equal(x, 'bbba')
  const y = padRight('a', 4, 'b')
  equal(y, 'abbb')
})
