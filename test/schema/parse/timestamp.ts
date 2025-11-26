import { test } from '../../shared/index.js'
import { parse } from '@based/sdk'

await test('timestamp', async () => {
  parse({
    types: {
      myType: {
        myTimestamp: {
          type: 'timestamp',
        },
        created: {
          type: 'timestamp',
          on: 'create',
        },
        lastModified: {
          type: 'timestamp',
          on: 'update',
        },
      },
    },
  })
})

// ADD STRING OPTION HERE
