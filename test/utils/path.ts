import { getByPath, setByPath } from '../../src/utils/index.js'
import { deepEqual, equal, test } from '../shared/index.js'

await test('setPath', async (t) => {
  const bla = {
    a: {
      b: {
        c: {
          bla: true,
        },
      },
    },
  }

  deepEqual(setByPath(bla, ['a', 'b', 'c', 'x', 0], 'snurp'), {
    a: {
      b: { c: { bla: true, x: ['snurp'] } },
    },
  })

  equal(getByPath(bla, ['a', 'b', 'c', 'x', 0]), 'snurp')
})
