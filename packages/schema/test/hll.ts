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

await test('cardinality props', () => {
  parse({
    props: {
      myUniqueValuesCountDense: {
        type: 'cardinality',
        mode: 'dense',
        precision: 12,
      },
    },
  })

  parse({
    props: {
      myUniqueValuesCountSparse: {
        type: 'cardinality',
        mode: 'sparse',
      },
    },
  })
})
