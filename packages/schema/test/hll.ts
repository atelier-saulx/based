import test from 'node:test'
import { parse } from '@based/schema'

await test('cardinality', () => {
  parse({
    types: {
      test: {
        myUniqueValuesCount: {
          type: 'cardinality',
        },
      },
    },
  })

  parse({
    types: {
      test: {
        myUniqueValuesCount: 'cardinality',
      },
    },
  })
})

await test('cardinality props', () => {
  parse({
    types: {
      test: {
        myUniqueValuesCountDense: {
          type: 'cardinality',
          mode: 'dense',
          precision: 12,
        },
      },
    },
  })

  parse({
    types: {
      test: {
        myUniqueValuesCountSparse: {
          type: 'cardinality',
          mode: 'sparse',
        },
      },
    },
  })

  parse({
    types: {
      test: {
        myUniqueValuesCountSparse: {
          type: 'cardinality',
          precision: 2,
        },
      },
    },
  })
})
