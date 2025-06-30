import test from 'node:test'
import { parse } from '@based/schema'

await test('cardinality', () => {
  parse({
    props: {
      myUniqueValuesCount: {
        type: 'cardinality',
      },
    },
  })

  parse({
    props: {
      myUniqueValuesCount: 'cardinality',
    },
  })
})
