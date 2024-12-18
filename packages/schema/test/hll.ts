import test from 'node:test'
import { parse } from '@based/schema'

test('hll', () => {
  parse({
    props: {
      myUniqueValuesCount: {
        type: 'hll',
      },
    },
  })

  parse({
    props: {
      myUniqueValuesCount: 'hll',
    },
  })
})
