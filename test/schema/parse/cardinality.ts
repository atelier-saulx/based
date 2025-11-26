import { test } from '../../shared/index.js'
import { parse } from '@based/sdk'

await test('cardinality', async () => {
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

await test('cardinality props', async () => {
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
