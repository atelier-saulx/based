import test from 'ava'
import { setByPath, getByPath } from '../src/index.js'

test('setPath', (t) => {
  const bla = {
    a: {
      b: {
        c: {
          bla: true,
        },
      },
    },
  }

  t.deepEqual(setByPath(bla, ['a', 'b', 'c', 'x', 0], 'snurp'), {
    a: {
      b: { c: { bla: true, x: ['snurp'] } },
    },
  })

  t.is(getByPath(bla, ['a', 'b', 'c', 'x', 0]), 'snurp')
  t.true(true)
})
