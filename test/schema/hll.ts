import test from 'node:test'
import { parse } from '@based/schema'

await test('cardinality', () => {
  parse({
    types: {
      myType: {
        myUniqueValuesCount: {
          type: 'cardinality',
        },
      },
    },
  })

  parse({
    types: {
      myType: {
        myUniqueValuesCount: 'cardinality',
      },
    },
  })
})

await test('cardinality props', () => {
  parse({
    types: {
      myType: {
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
      myType: {
        myUniqueValuesCountSparse: {
          type: 'cardinality',
          mode: 'sparse',
        },
      },
    },
  })

  parse({
    types: {
      myType: {
        myUniqueValuesCountSparse: {
          type: 'cardinality',
          precision: 2,
        },
      },
    },
  })
})
